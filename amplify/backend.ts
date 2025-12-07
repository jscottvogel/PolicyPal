import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { chatFunction } from './functions/chat/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  chatFunction,
});

import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

backend.chatFunction.resources.lambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:*'],
  resources: ['*'],
}));
