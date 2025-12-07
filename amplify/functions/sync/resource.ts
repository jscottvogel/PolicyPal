import { defineFunction } from '@aws-amplify/backend';

export const syncFunction = defineFunction({
    name: 'sync',
    entry: './handler.ts',
    environment: {
        KNOWLEDGE_BASE_ID: 'I0ZDDNQ4PP',
        DATA_SOURCE_ID: '9ADALNYYBL',
    },
    timeoutSeconds: 60,
});
