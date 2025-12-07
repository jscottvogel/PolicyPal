import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { chatFunction } from './functions/chat/resource';

defineBackend({
  auth,
  data,
  storage,
  chatFunction,
});
