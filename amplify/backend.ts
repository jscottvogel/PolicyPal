import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { chatFunction } from './functions/chat/resource';
import { syncFunction } from './functions/sync/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  chatFunction,
  syncFunction,
});

import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';

backend.chatFunction.resources.lambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:*'],
  resources: ['*'],
}));

// Enable X-Ray Tracing for Chat
const chatCfn = backend.chatFunction.resources.lambda.node.defaultChild as CfnFunction;
chatCfn.tracingConfig = {
  mode: 'Active',
};

// Permissions for Sync
backend.syncFunction.resources.lambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:*'],
  resources: ['*'],
}));
