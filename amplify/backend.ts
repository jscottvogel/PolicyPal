import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { chatFunction } from './functions/chat/resource';
import { syncFunction } from './functions/sync/resource';
import { checkIndexFunction } from './functions/check-index/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  chatFunction,
  syncFunction,
  checkIndexFunction,
});

import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { CfnFunction, Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';

const syncLambda = backend.syncFunction.resources.lambda as LambdaFunction;
const chatLambda = backend.chatFunction.resources.lambda as LambdaFunction;
const checkIndexLambda = backend.checkIndexFunction.resources.lambda as LambdaFunction;

// Permissions for Chat
chatLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:*'],
  resources: ['*'],
}));

// Enable X-Ray Tracing for Chat
const chatCfn = chatLambda.node.defaultChild as CfnFunction;
chatCfn.tracingConfig = {
  mode: 'Active',
};

// Permissions for Sync
syncLambda.addToRolePolicy(new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['bedrock:*'],
  resources: ['*'],
}));

// --- Access to S3 for Manual RAG ---
const bucket = backend.storage.resources.bucket;

// Grant read/write to Sync (to read policies and write index)
bucket.grantReadWrite(syncLambda);
syncLambda.addEnvironment('BUCKET_NAME', bucket.bucketName);

// Grant read to Chat (to read index and policies)
bucket.grantRead(chatLambda);
chatLambda.addEnvironment('BUCKET_NAME', bucket.bucketName);

// Grant read to Check Index
bucket.grantRead(checkIndexLambda);
checkIndexLambda.addEnvironment('BUCKET_NAME', bucket.bucketName);
