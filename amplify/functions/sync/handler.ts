
import type { Schema } from '../../data/resource';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { generateEmbedding, splitText, VectorDoc } from '../common/vector-utils';
import { randomUUID } from 'crypto';

// @ts-ignore
import { extractText } from 'unpdf';

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
    console.log("Starting Incremental Sync (unpdf)...");

    if (!BUCKET_NAME) {
        return { success: false, message: "BUCKET_NAME env var missing." };
    }

    try {
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

        const listCmd = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: 'public/'
        });
        const listRes = await s3.send(listCmd);

        if (!listRes.Contents || listRes.Contents.length === 0) {
            return { success: true, message: "No files found." };
        }

        const indexedPaths = new Set(
            existingIndex
                .filter(d => d.metadata?.type === 'file_marker')
                .map(d => d.path)
        );

        const outputDocs: VectorDoc[] = [...existingIndex];
        let processedCount = 0;
        let targetFiles = listRes.Contents || [];

        // @ts-ignore
        if (event.arguments?.filePath) {
            // @ts-ignore
            const targetPath = event.arguments.filePath;
            console.log(`Targeting specific file: ${targetPath}`);
            targetFiles = targetFiles.filter(f => f.Key === targetPath);
            indexedPaths.delete(targetPath);
        }

        for (const file of targetFiles) {
            if (!file.Key || file.Key.endsWith('/')) continue;

            // @ts-ignore
            if (!event.arguments?.filePath && indexedPaths.has(file.Key)) {
                console.log(`Skipping fully indexed file: ${file.Key}`);
                continue;
            }

            console.log(`Processing file: ${file.Key}`);
            processedCount++;

            const initialLength = outputDocs.length;
            const keptDocs = outputDocs.filter(d => d.path !== file.Key);
            outputDocs.length = 0;
            outputDocs.push(...keptDocs);

            if (outputDocs.length < initialLength) {
                console.log(`Cleaned up ${initialLength - outputDocs.length} old/partial chunks for ${file.Key}`);
            }

            try {
                const getCmd = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.Key
                });
                const getRes = await s3.send(getCmd);
                const fileBuffer = await streamToBuffer(getRes.Body);
                console.log(`Downloaded buffer size for ${file.Key}: ${fileBuffer.length}`);

                let text = "";
                if (file.Key.toLowerCase().endsWith('.pdf')) {
                    try {
                        console.log(`Parsing PDF with unpdf: ${file.Key}`);
                        // @ts-ignore
                        const { text: pdfText } = await extractText(new Uint8Array(fileBuffer));
                        text = Array.isArray(pdfText) ? pdfText.join("\n") : pdfText;
                        console.log(`Parsed PDF successfully (unpdf): ${text.length} chars`);
                        if (text.length > 0) {
                            console.log(`Sample: ${text.substring(0, 100)}`);
                        }
                    } catch (pErr) {
                        console.error(`PDF Parsing failed for ${file.Key}:`, pErr);
                        continue;
                    }
                } else {
                    text = fileBuffer.toString('utf-8');
                }

                if (!text.trim()) continue;

                const chunks = splitText(text);
                console.log(`Generating embeddings for ${chunks.length} chunks...`);

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

                outputDocs.push({
                    id: randomUUID(),
                    path: file.Key as string,
                    text: "",
                    embedding: [],
                    metadata: { type: 'file_marker', timestamp: new Date().toISOString() }
                });

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
