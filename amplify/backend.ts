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
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';

backend.chatFunction.resources.lambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:*'],
  resources: ['*'],
}));

// Enable X-Ray Tracing
const cfnFunction = backend.chatFunction.resources.lambda.node.defaultChild as CfnFunction;
cfnFunction.tracingConfig = {
  mode: 'Active',
};
