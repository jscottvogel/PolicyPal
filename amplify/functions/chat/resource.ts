import { defineFunction } from '@aws-amplify/backend';

export const chatFunction = defineFunction({
    name: 'chat',
    entry: './handler.ts',
    environment: {
        MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0', // Or another available model
        KNOWLEDGE_BASE_ID: 'REPLACE_ME_WITH_KB_ID', // User must update this after creating KB
    },
});
