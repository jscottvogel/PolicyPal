import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export interface VectorDoc {
    id: string;
    path: string;
    text: string;
    embedding: number[];
    metadata?: any;
}

export async function generateEmbedding(text: string): Promise<number[]> {
    // Using Titan Embeddings v1. v2 is also an option: amazon.titan-embed-text-v2:0
    const modelId = "amazon.titan-embed-text-v1";

    const response = await client.send(new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({ inputText: text })
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.embedding;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] ** 2;
        normB += vecB[i] ** 2;
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Simple text splitter to avoid heavy dependencies
export function splitText(text: string, chunkSize: number = 1000, overlap: number = 100): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        let end = start + chunkSize;

        // If we are not at the end, try to break at a newline or space
        if (end < text.length) {
            const lastNewline = text.lastIndexOf('\n', end);
            const lastSpace = text.lastIndexOf(' ', end);

            if (lastNewline > start + overlap) {
                end = lastNewline;
            } else if (lastSpace > start + overlap) {
                end = lastSpace;
            }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        // Move start forward, accounting for overlap
        start = end - overlap;

        // Safety check to prevent infinite loops if overlap >= chunkSize (shouldn't happen with defaults)
        if (start >= end) start = end;
    }

    return chunks;
}
