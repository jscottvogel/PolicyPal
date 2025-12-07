import type { Schema } from '../../data/resource';
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export const handler: Schema["chat"]["functionHandler"] = async (event) => {
    const { message } = event.arguments;

    if (!message) {
        return { answer: "Please provide a message.", citations: [] };
    }

    try {
        const prompt = `System: You are PolicyPal, a helpful assistant answering questions about company policies.
    User: ${message}
    Assistant:`;

        const input = {
            modelId: process.env.MODEL_ID,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: message
                            }
                        ]
                    }
                ]
            }),
        };

        const command = new InvokeModelCommand(input);
        const response = await client.send(command);

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const answer = responseBody.content[0].text;

        // TODO: Add Retrieval logic here to get citations
        const citations: string[] = [];

        return {
            answer,
            citations
        };
    } catch (error) {
        console.error(error);
        return {
            answer: "I'm sorry, I'm having trouble connecting to my brain right now.",
            citations: []
        };
    }
};
