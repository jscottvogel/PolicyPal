import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'policyDrive',
    access: (allow) => ({
        'public/*': [
            allow.authenticated.to(['read', 'write']),
            allow.groups(['Admins']).to(['read', 'write', 'delete']),
        ],
    })
});
