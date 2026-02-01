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
    console.log("Starting Manual Sync...");

    if (!BUCKET_NAME) {
        return { success: false, message: "BUCKET_NAME env var missing." };
    }

    try {
        // 1. List all files in 'public/'
        const listCmd = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: 'public/'
        });
        const listRes = await s3.send(listCmd);

        if (!listRes.Contents || listRes.Contents.length === 0) {
            return { success: true, message: "No files found to sync." };
        }

        const vectorDocs: VectorDoc[] = [];

        for (const file of listRes.Contents) {
            if (!file.Key || file.Key.endsWith('/')) continue;

            console.log(`Processing file: ${file.Key}`);

            try {
                // 2. Download File
                const getCmd = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: file.Key
                });
                const getRes = await s3.send(getCmd);
                const fileBuffer = await streamToBuffer(getRes.Body);

                // 3. Extract Text
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

                // 4. Chunk Text
                const chunks = splitText(text);

                // 5. Generate Embeddings for chunks
                console.log(`Generating embeddings for ${chunks.length} chunks...`);
                for (const chunk of chunks) {
                    const embedding = await generateEmbedding(chunk);
                    vectorDocs.push({
                        id: randomUUID(),
                        path: file.Key,
                        text: chunk,
                        embedding: embedding
                    });
                }
            } catch (err: any) {
                console.error(`Error processing file ${file.Key}:`, err);
                console.error(`Error details:`, err.message, err.stack);
            }
        }

        // 6. Save Index to S3
        console.log(`Saving index with ${vectorDocs.length} chunks to vectors/index.json`);
        const putCmd = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: 'vectors/index.json',
            Body: JSON.stringify(vectorDocs),
            ContentType: 'application/json'
        });
        await s3.send(putCmd);

        return {
            success: true,
            message: `Sync complete. Indexed ${vectorDocs.length} chunks.`
        };

    } catch (error) {
        console.error("Sync Failed:", error);
        return {
            success: false,
            message: "Failed to sync. Check logs."
        };
    }
};
