import type { Schema } from '../../data/resource';
import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const agentClient = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION });
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export const handler: Schema["chat"]["functionHandler"] = async (event) => {
    const { message } = event.arguments;
    console.log("Receive Chat Request:", { message });

    if (!message) {
        return { answer: "Please provide a message.", citations: [] };
    }

    const kbId = process.env.KNOWLEDGE_BASE_ID;
    const modelId = process.env.MODEL_ID;
    console.log("Configuration:", { kbId, modelId, region: process.env.AWS_REGION });

    try {
        // If KB is configured, use RAG
        if (kbId && kbId !== 'REPLACE_ME_WITH_KB_ID') {
            console.log("Path: RAG (retrieveAndGenerate)");
            const command = new RetrieveAndGenerateCommand({
                input: {
                    text: message
                },
                retrieveAndGenerateConfiguration: {
                    type: 'KNOWLEDGE_BASE',
                    knowledgeBaseConfiguration: {
                        knowledgeBaseId: kbId,
                        modelArn: `arn:aws:bedrock:${process.env.AWS_REGION}::foundation-model/${modelId}`
                    }
                }
            });

            const response = await agentClient.send(command);
            console.log("Bedrock RAG Response Received");

            const answer = response.output?.text || "No answer found.";
            const citations = response.citations?.map(c =>
                c.retrievedReferences?.map(r => r.content?.text).join(' ') || ''
            ) || [];

            return { answer, citations: citations.filter(c => c) };

        } else {
            // Fallback to standard chat (no RAG)
            console.log("Path: Standard Chat (invokeModel)");
            const prompt = `System: You are PolicyPal.
      User: ${message}
      Assistant:`;

            const input = {
                modelId: modelId,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify({
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 1000,
                    messages: [{ role: "user", content: [{ type: "text", text: message }] }]
                }),
            };

            const command = new InvokeModelCommand(input);
            const response = await bedrockClient.send(command);
            console.log("Bedrock Standard Response Received");

            const responseBody = JSON.parse(new TextDecoder().decode(response.body));
            const answer = responseBody.content[0].text;

            return { answer: answer + "\n\n(Note: RAG not enabled. Please configure Knowledge Base ID.)", citations: [] };
        }
    } catch (error) {
        console.error("Error in Chat Function:", error);
        return {
            answer: "I'm sorry, I'm having trouble connecting to my brain right now.",
            citations: []
        };
    }
};
