import type { Schema } from '../../data/resource';
import { BedrockAgentClient, StartIngestionJobCommand } from "@aws-sdk/client-bedrock-agent";

const client = new BedrockAgentClient({ region: process.env.AWS_REGION });

export const handler: Schema["sync"]["functionHandler"] = async (event) => {
    const kbId = process.env.KNOWLEDGE_BASE_ID;
    const dsId = process.env.DATA_SOURCE_ID;

    console.log("Starting Sync:", { kbId, dsId });

    if (!kbId || !dsId || dsId === 'REPLACE_ME_WITH_DS_ID') {
        return {
            success: false,
            message: "Missing Knowledge Base or Data Source ID configuration."
        };
    }

    try {
        const command = new StartIngestionJobCommand({
            knowledgeBaseId: kbId,
            dataSourceId: dsId,
            description: "Triggered by PolicyPal Admin"
        });

        const response = await client.send(command);
        console.log("Sync Started:", response.ingestionJob);

        return {
            success: true,
            message: `Sync started. Status: ${response.ingestionJob?.status}`
        };
    } catch (error) {
        console.error("Sync Failed:", error);
        return {
            success: false,
            message: "Failed to start sync job. Check logs."
        };
    }
};
