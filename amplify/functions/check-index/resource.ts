import { defineFunction } from '@aws-amplify/backend';

export const checkIndexFunction = defineFunction({
    name: 'check-index',
    entry: './handler.ts',
    timeoutSeconds: 30,
});
