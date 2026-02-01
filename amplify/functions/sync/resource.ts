import { defineFunction } from '@aws-amplify/backend';

export const syncFunction = defineFunction({
    name: 'sync',
    entry: './handler.ts',
    environment: {
        // KNOWLEDGE_BASE_ID and DATA_SOURCE_ID removed. Using manual S3 indexing.
    },
    timeoutSeconds: 60,
});
