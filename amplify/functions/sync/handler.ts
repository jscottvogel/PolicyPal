import type { Schema } from '../../data/resource';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { generateEmbedding, splitText, VectorDoc } from '../common/vector-utils';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { randomUUID } from 'crypto';

// Polyfill DOMMatrix for pdf-parse if it is missing (Lambda runtime environment)
if (!global.DOMMatrix) {
    // @ts-ignore
    global.DOMMatrix = class DOMMatrix { };
}

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
    console.log("Starting Incremental Sync...");

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
        const indexedPaths = new Set(existingIndex.map(d => d.path));

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

            // If specific file is requested, we ALWAYS process it (re-index),
            // so we remove old chunks for this file from outputDocs first.
            const initialDocCount = outputDocs.length;
            const newOutputDocs = outputDocs.filter(d => d.path !== targetPath);
            if (newOutputDocs.length < initialDocCount) {
                console.log(`Removing ${initialDocCount - newOutputDocs.length} existing chunks for re-indexing ${targetPath}`);
                outputDocs.length = 0; // Clear array
                outputDocs.push(...newOutputDocs);
            }
        }

        for (const file of targetFiles) {
            if (!file.Key || file.Key.endsWith('/')) continue;

            // Incrementality Check (Skip ONLY if not explicitly requested)
            // @ts-ignore
            if (!event.arguments?.filePath && indexedPaths.has(file.Key)) {
                console.log(`Skipping already indexed file: ${file.Key}`);
                continue;
            }

            console.log(`Processing file: ${file.Key}`);
            processedCount++;

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
                    // pdf-parse v1.1.1 API
                    const pdfData = await pdf(fileBuffer);
                    text = pdfData.text;
                } else {
                    // Assume text-based
                    text = fileBuffer.toString('utf-8');
                }

                if (!text.trim()) continue;

                // Chunk Text
                const chunks = splitText(text);

                // Generate Embeddings (Parallel Batches)
                console.log(`Generating embeddings for ${chunks.length} chunks...`);

                const BATCH_SIZE = 3; // Reduced batch size for stability
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

                    // Small delay to prevent rate limiting / cpu starvation
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // CHECKPOINT: Save index after each successful file processing
                console.log(`Checkpoint: Saving index with ${outputDocs.length} chunks...`);

                // Optimize save: only save if we actually added chunks
                if (outputDocs.length > existingIndex.length) {
                    const putCmd = new PutObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: 'vectors/index.json',
                        Body: JSON.stringify(outputDocs),
                        ContentType: 'application/json'
                    });
                    await s3.send(putCmd);
                    processedCount++;
                    console.log(`Saved checkpoint for ${file.Key}.`);
                } else {
                    console.log("No new chunks to save.");
                }

            } catch (err: any) {
                console.error(`Error processing file ${file.Key}:`, err);
            }
        }

        return {
            success: true,
            message: `Sync complete. Added ${processedCount} new files.`
        };

    } catch (error) {
        console.error("Sync Failed:", error);
        return {
            success: false,
            message: "Failed to sync. Check logs."
        };
    }
};
