import type { Schema } from '../../data/resource';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { generateEmbedding, cosineSimilarity, VectorDoc } from '../common/vector-utils';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME;

// Simple in-memory cache
let cachedIndex: VectorDoc[] | null = null;
let lastLoadTime = 0;
const CACHE_TTL = 300000; // 5 minutes

// Helper to convert stream to string
const streamToString = (stream: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
};

export const handler: Schema["chat"]["functionHandler"] = async (event) => {
    const { message } = event.arguments;
    console.log("Receive Chat Request:", { message });

    if (!message) {
        return { answer: "Please provide a message.", citations: [] };
    }

    if (!BUCKET_NAME) {
        return { answer: "Configuration error: BUCKET_NAME missing.", citations: [] };
    }

    try {
        // 1. Load Index (with caching)
        const now = Date.now();
        if (!cachedIndex || (now - lastLoadTime > CACHE_TTL)) {
            console.log("Loading vector index from S3...");
            try {
                const getCmd = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: 'vectors/index.json'
                });
                const res = await s3.send(getCmd);
                const body = await streamToString(res.Body);
                cachedIndex = JSON.parse(body);
                lastLoadTime = now;
                console.log(`Index loaded. ${cachedIndex?.length} chunks.`);
            } catch (err: any) {
                console.warn("Failed to load index (might not exist yet):", err.message);
                cachedIndex = [];
            }
        }

        let context = "";
        let citations: any[] = [];

        // 2. Perform Retrieval if index exists
        if (cachedIndex && cachedIndex.length > 0) {
            console.log("Generating embedding for query...");
            const queryEmbedding = await generateEmbedding(message);

            // Calculate similarity scores
            const scoredDocs = cachedIndex.map(doc => ({
                ...doc,
                score: cosineSimilarity(queryEmbedding, doc.embedding)
            }));

            // Sort by score desc
            scoredDocs.sort((a, b) => b.score - a.score);

            // Take top 5
            const topDocs = scoredDocs.slice(0, 5);
            console.log("Top matches scores:", topDocs.map(d => d.score));

            // Filter by threshold (lowered to ensure matches)
            const qualifiedDocs = topDocs.filter(d => d.score > 0.15);

            if (qualifiedDocs.length > 0) {
                context = qualifiedDocs.map(d => d.text).join("\n\n---\n\n");
                // Deduplicate citations by path
                const uniquePaths = new Set();
                citations = qualifiedDocs.reduce((acc: any[], doc) => {
                    if (!uniquePaths.has(doc.path)) {
                        uniquePaths.add(doc.path);
                        acc.push({
                            text: doc.text.substring(0, 100) + "...", // Snippet
                            path: doc.path
                        });
                    }
                    return acc;
                }, []);
            }
        } else {
            console.log("No index available, proceeding without context.");
            return {
                answer: "The policy search index is empty. Please upload policies to the 'public/' S3 folder and run the 'Sync' command in the Admin dashboard to generate the index.",
                citations: []
            };
        }

        // 3. Call LLM
        const modelId = process.env.MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

        const systemPrompt = `You are PolicyPal, a helpful assistant. 
Use the following context to answer the user's question accurately. 
If the answer is not in the context, say "I couldn't find that information in the policies" and suggest checking with HR. 
Do not hallucinate.

Context:
${context}
`;

        const bedrockBody = {
            anthropic_version: "bedrock-2023-05-31",
            max_tokens: 1000,
            system: systemPrompt,
            messages: [
                { role: "user", content: message }
            ]
        };

        const command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(bedrockBody)
        });

        const response = await bedrock.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        // Claude 3 response structure
        const answer = responseBody.content?.[0]?.text || "No response generated.";

        return { answer, citations };

    } catch (error) {
        console.error("Error in Chat Function:", error);
        return {
            answer: "I encountered an error processing your request. Please try again later.",
            citations: []
        };
    }
};
