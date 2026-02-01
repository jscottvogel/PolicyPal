import type { Schema } from '../../data/resource';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { generateEmbedding, splitText, VectorDoc } from '../common/vector-utils';
import { randomUUID } from 'crypto';
import { PdfDataParser } from 'pdf-data-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME;

// Helper to convert stream to buffer
const streamToBuffer = async (stream: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

export const handler: Schema["sync"]["functionHandler"] = async (event) => {
    console.log("Starting Incremental Sync (pdf-data-parser)...");

    if (!BUCKET_NAME) {
        return { success: false, message: "BUCKET_NAME env var missing." };
    }

    try {
        // 1. Load Existing Index
        let existingIndex: VectorDoc[] = [];
        try {
            const getIndex = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: 'vectors/index.json'
            });
            const getIndexRes = await s3.send(getIndex);
            const body = await streamToBuffer(getIndexRes.Body);
            existingIndex = JSON.parse(body.toString('utf-8'));
            console.log(`Loaded existing index with ${existingIndex.length} chunks.`);
        } catch (e) {
            console.log("No existing index found or error loading it, starting fresh.");
        }

        // 2. List all files in 'public/'
        const listCmd = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: 'public/'
        });
        const listRes = await s3.send(listCmd);

        if (!listRes.Contents || listRes.Contents.length === 0) {
            return { success: true, message: "No files found." };
        }

        // 3. Identify Files to Process
        // Check for "File Marker" to confirm completion.
        // A file is "indexed" only if it has a completion marker.
        const indexedPaths = new Set(
            existingIndex
                .filter(d => d.metadata?.type === 'file_marker')
                .map(d => d.path)
        );

        const outputDocs: VectorDoc[] = [...existingIndex];
        let processedCount = 0;

        // Determine target files
        let targetFiles = listRes.Contents || [];

        // If a specific file path is requested, filter just that one
        // @ts-ignore
        if (event.arguments?.filePath) {
            // @ts-ignore
            const targetPath = event.arguments.filePath;
            console.log(`Targeting specific file: ${targetPath}`);
            targetFiles = targetFiles.filter(f => f.Key === targetPath);

            // Re-indexing: Force processing even if marked complete
            indexedPaths.delete(targetPath);
        }

        for (const file of targetFiles) {
            if (!file.Key || file.Key.endsWith('/')) continue;

            // Skip ONLY if we have a completion marker and it wasn't explicitly requested
            // @ts-ignore
            if (!event.arguments?.filePath && indexedPaths.has(file.Key)) {
                console.log(`Skipping fully indexed file: ${file.Key}`);
                continue;
            }

            console.log(`Processing file: ${file.Key}`);
            processedCount++;

            // CLEANUP: Remove any existing chunks (partial or old) for this file from the output index
            // This ensures we don't have duplicates or ghosts from failed runs.
            const initialLength = outputDocs.length;
            const keptDocs = outputDocs.filter(d => d.path !== file.Key);
            outputDocs.length = 0;
            outputDocs.push(...keptDocs);

            if (outputDocs.length < initialLength) {
                console.log(`Cleaned up ${initialLength - outputDocs.length} old/partial chunks for ${file.Key}`);
            }

            try {
                // Download File
                const getCmd = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.Key
                });
                const getRes = await s3.send(getCmd);
                const fileBuffer = await streamToBuffer(getRes.Body);

                // Extract Text
                let text = "";
                if (file.Key.toLowerCase().endsWith('.pdf')) {
                    console.log(`Parsing PDF with pdf-data-parser: ${file.Key}`);

                    const tmpPath = path.join(os.tmpdir(), randomUUID() + '.pdf');
                    fs.writeFileSync(tmpPath, fileBuffer);

                    try {
                        const parser = new PdfDataParser({ url: tmpPath });
                        // Safety timeout for parser
                        const parsePromise = parser.parse();
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("PDF Parsing timeout (60s)")), 60000)
                        );

                        // @ts-ignore
                        const rows = await Promise.race([parsePromise, timeoutPromise]);

                        // Flatten rows (array of strings)
                        // @ts-ignore
                        text = rows.map((r: any) => r.join(" ")).join("\n");
                        console.log(`Parsed PDF successfully: ${text.length} chars`);
                    } catch (pErr) {
                        console.error(`PDF Parsing failed for ${file.Key}:`, pErr);
                        continue; // Skip this file
                    } finally {
                        try { fs.unlinkSync(tmpPath); } catch { }
                    }
                } else {

                    // Assume text-based
                    text = fileBuffer.toString('utf-8');
                }

                if (!text.trim()) continue;

                // Chunk Text
                const chunks = splitText(text);

                // Generate Embeddings (Parallel Batches)
                console.log(`Generating embeddings for ${chunks.length} chunks...`);

                // High concurrency, no intermediate S3 saves to prevent simple timeout
                const BATCH_SIZE = 10;
                for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                    const batch = chunks.slice(i, i + BATCH_SIZE);
                    await Promise.all(batch.map(async (chunk) => {
                        try {
                            const embedding = await generateEmbedding(chunk);
                            outputDocs.push({
                                id: randomUUID(),
                                path: file.Key as string,
                                text: chunk,
                                embedding: embedding
                            });
                        } catch (err) {
                            console.error("Embedding generation failed for chunk:", err);
                        }
                    }));
                }

                // Add Completion Marker
                outputDocs.push({
                    id: randomUUID(),
                    path: file.Key as string,
                    text: "", // Empty
                    embedding: [], // Empty
                    metadata: { type: 'file_marker', timestamp: new Date().toISOString() }
                });

                // Save index ONLY after the file is fully processed
                console.log(`Saving index with ${outputDocs.length} chunks...`);
                const putCmd = new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: 'vectors/index.json',
                    Body: JSON.stringify(outputDocs),
                    ContentType: 'application/json'
                });
                await s3.send(putCmd);
                console.log(`Saved index for ${file.Key}.`);

            } catch (err: any) {
                console.error(`Error processing file ${file.Key}:`, err);
            }
        }

        if (processedCount > 0) {
            return {
                success: true,
                message: `Sync complete. Processed ${processedCount} files.`
            };
        }
        return { success: true, message: "Sync complete. No modifications." };

    } catch (error) {
        console.error("Sync Failed:", error);
        return {
            success: false,
            message: "Failed to sync. Check logs."
        };
    }
};
