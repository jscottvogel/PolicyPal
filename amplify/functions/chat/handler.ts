import type { Schema } from '../../data/resource';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { generateEmbedding, cosineSimilarity, VectorDoc } from '../common/vector-utils';

const s3 = new S3Client({ region: process.env.AWS_REGION });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME;

// In-memory cache
let cachedIndex: VectorDoc[] | null = null;
let indexLastModified: Date | undefined = undefined;

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
    const { message, forceRefresh } = event.arguments;
    console.log("Receive Chat Request:", { message, forceRefresh });

    if (!message && !forceRefresh) {
        return { answer: "Please provide a message.", citations: [] };
    }

    if (!BUCKET_NAME) {
        return { answer: "Configuration error: BUCKET_NAME missing.", citations: [] };
    }
    try {
        // 1. Check if Index needs reloading
        let shouldReload = !!forceRefresh;
        let newLastModified: Date | undefined;

        if (!shouldReload) {
            try {
                const headCmd = new HeadObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: 'vectors/index.json'
                });
                const headRes = await s3.send(headCmd);
                newLastModified = headRes.LastModified;

                const cachedTime = indexLastModified ? indexLastModified.getTime() : 0;
                const s3Time = newLastModified ? newLastModified.getTime() : 0;

                console.log(`Cache Status: cachedIndex=${!!cachedIndex}, cachedTime=${cachedTime}, s3Time=${s3Time}`);

                if (!cachedIndex || s3Time > cachedTime) {
                    console.log(`Index changed or missing. Reloading... (S3: ${s3Time} > Cache: ${cachedTime})`);
                    shouldReload = true;
                } else {
                    console.log("Index unchanged. Using cache.");
                }
            } catch (e) {
                console.log("Index not found on S3 or error checking metadata:", e);
                shouldReload = !cachedIndex;
            }
        }

        if (shouldReload) {
            console.log("Loading vector index from S3...");
            try {
                const getCmd = new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: 'vectors/index.json'
                });
                const res = await s3.send(getCmd);
                const body = await streamToString(res.Body);
                cachedIndex = JSON.parse(body);
                indexLastModified = newLastModified || new Date();
                console.log(`Index loaded. ${cachedIndex?.length} chunks. New LastModified: ${indexLastModified.getTime()}`);
            } catch (err: any) {
                console.warn("Failed to load index:", err.message);
                indexLastModified = undefined;
            }
        }

        // Handle refresh-only call
        if (forceRefresh && !message) {
            return { answer: "Cache has been refreshed.", citations: [] };
        }

        // ...

        let context = "";
        let citations: any[] = [];

        // 2. Perform Retrieval if index exists
        if (cachedIndex && cachedIndex.length > 0 && message) {
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
                // Deduplicate citations by path and assign indices
                const uniquePaths = Array.from(new Set(qualifiedDocs.map(d => d.path)));

                citations = uniquePaths.map((path, idx) => {
                    const firstMatch = qualifiedDocs.find(d => d.path === path);
                    return {
                        text: firstMatch?.text.substring(0, 150) + "...",
                        path: path
                    };
                });

                // Format context with source labels
                context = qualifiedDocs.map(d => {
                    const sourceIdx = uniquePaths.indexOf(d.path) + 1;
                    return `[Source ${sourceIdx}] (${d.path.replace('public/', '')}):\n${d.text}`;
                }).join("\n\n---\n\n");
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

        const systemPrompt = `You are PolicyPal, a helpful assistant for company policies.
Answer the user's question using ONLY the provided context.

CITATION RULES:
- You MUST use square bracket citations like [1], [2] at the end of every sentence that uses information from a source.
- Do NOT use source names like "According to the Vacation Policy" or "Source 1 says". Just state the fact and append the marker [1].
- If the answer isn't in the context, say "I couldn't find that information in the policies" and suggest checking with HR.
- If multiple sources support a point, use [1][2].

Example Response:
Employees are entitled to 20 days of PTO per year [1]. This must be requested 2 weeks in advance [2].

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
        let answerText = responseBody.content?.[0]?.text || "No response generated.";

        // 4. Refine citations: Only return those actually referenced in the answer
        // and re-index them so the citations list matches the [1], [2] in the text.
        const markers = Array.from(answerText.matchAll(/\[(\d+)\]/g)).map((m: any) => parseInt(m[1]));
        const uniqueReferencedIndices = Array.from(new Set(markers)).sort((a, b) => a - b);

        const oldToNewMap: Record<number, number> = {};
        const filteredCitations: any[] = [];

        uniqueReferencedIndices.forEach((oldIdx, i) => {
            const newIdx = i + 1;
            oldToNewMap[oldIdx] = newIdx;
            // uniquePaths indices in 'context' were 1-based, so oldIdx-1 is the array index
            if (citations[oldIdx - 1]) {
                filteredCitations.push(citations[oldIdx - 1]);
            }
        });

        // Replace markers in the text with new indices
        if (filteredCitations.length > 0) {
            answerText = answerText.replace(/\[(\d+)\]/g, (match: string, p1: string) => {
                const oldIdx = parseInt(p1);
                return oldToNewMap[oldIdx] ? `[${oldToNewMap[oldIdx]}]` : match;
            });
        }

        return {
            answer: answerText,
            citations: filteredCitations
        };

    } catch (error) {
        console.error("Error in Chat Function:", error);
        return {
            answer: "I encountered an error processing your request. Please try again later.",
            citations: []
        };
    }
};
