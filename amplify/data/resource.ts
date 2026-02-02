import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { chatFunction } from '../functions/chat/resource';
import { syncFunction } from '../functions/sync/resource';
import { checkIndexFunction } from '../functions/check-index/resource';

const schema = a.schema({
  Citation: a.customType({
    text: a.string(),
    path: a.string(),
  }),

  ChatResponse: a.customType({
    answer: a.string(),
    citations: a.ref('Citation').array(),
  }),

  SyncResponse: a.customType({
    success: a.boolean(),
    message: a.string(),
  }),

  chat: a
    .query()
    .arguments({
      message: a.string(),
      forceRefresh: a.boolean()
    })
    .returns(a.ref('ChatResponse'))
    .handler(a.handler.function(chatFunction))
    .authorization((allow) => [allow.authenticated()]),

  sync: a
    .mutation()
    .arguments({
      filePath: a.string(),
      clear: a.boolean()
    })
    .returns(a.ref('SyncResponse'))
    .handler(a.handler.function(syncFunction))
    .authorization((allow) => [allow.authenticated()]),

  getIndexedFiles: a
    .query()
    .returns(a.string().array())
    .handler(a.handler.function(checkIndexFunction))
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
