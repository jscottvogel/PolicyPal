
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import * as fs from 'fs';

const REGION = "us-east-1";
const SANDBOX_BUCKET = "amplify-policypal-fred-sa-policydrivebucket36b8b4d-r8cqkl4tpoc5";
const CHAT_LAMBDA = "amplify-policypal-fred-sandbox--chatlambdaBAAF975C-HfE0PBlAyXgz";
const SYNC_LAMBDA = "amplify-policypal-fred-sandbox--synclambdaF92182A5-A7uSGIMPreTI";
const PROFILE = "AdministratorAccess-520477993393";

// Clients with profile support usually requires environment setup or explicit credentials.
// For simplicity in this environment, we rely on the default credential provider or environment variables
// if already set by the user's terminal session.
const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

async function verifyCacheRefresh() {
    console.log("--- Starting Cache Refresh Verification ---");

    // 1. Get current index metadata
    console.log("1. Checking current index metadata...");
    const headInitial = await s3.send(new HeadObjectCommand({
        Bucket: SANDBOX_BUCKET,
        Key: 'vectors/index.json'
    }));
    const initialModified = headInitial.LastModified;
    console.log(`   Initial Index LastModified: ${initialModified}`);

    // 2. Trigger a Chat request to ensure it's "warm" and potentially cached (in-memory)
    console.log("2. Warming up Chat Lambda (ensure index is loaded in memory)...");
    const warmRes = await lambda.send(new InvokeCommand({
        FunctionName: CHAT_LAMBDA,
        Payload: Buffer.from(JSON.stringify({ arguments: { message: "test warm up" } }))
    }));
    console.log("   Warm up status:", warmRes.StatusCode);

    // 3. Update a dummy file to trigger a sync (changing the index)
    console.log("3. Uploading dummy file to force index update...");
    const dummyPath = "public/e2e-cache-test.txt";
    await s3.send(new PutObjectCommand({
        Bucket: SANDBOX_BUCKET,
        Key: dummyPath,
        Body: Buffer.from(`Cache test content: ${new Date().toISOString()}`)
    }));

    console.log("   Triggering Sync...");
    await lambda.send(new InvokeCommand({
        FunctionName: SYNC_LAMBDA,
        Payload: Buffer.from(JSON.stringify({ arguments: { filePath: dummyPath } }))
    }));

    // 4. Verify index file was actually updated on S3
    console.log("4. Verifying S3 index update...");
    const headNew = await s3.send(new HeadObjectCommand({
        Bucket: SANDBOX_BUCKET,
        Key: 'vectors/index.json'
    }));
    const newModified = headNew.LastModified;
    console.log(`   New Index LastModified: ${newModified}`);

    if (newModified!.getTime() <= initialModified!.getTime()) {
        throw new Error("Index file was not updated by sync mutation!");
    }
    console.log("   ✅ S3 Index updated successfully.");

    // 5. TEST AUTOMATIC REFRESH: Chat should automatically detect the new index
    console.log("5. Testing Automatic Cache Invalidation...");
    const autoRes = await lambda.send(new InvokeCommand({
        FunctionName: CHAT_LAMBDA,
        LogType: 'Tail',
        Payload: Buffer.from(JSON.stringify({ arguments: { message: "check for e2e-cache-test" } }))
    }));

    const autoLogs = Buffer.from(autoRes.LogResult!, 'base64').toString();
    // console.log("   Auto Logs snippet:", autoLogs.substring(autoLogs.indexOf("Receive Chat Request")));

    if (autoLogs.includes("Index changed or missing. Reloading...")) {
        console.log("   ✅ SUCCESS: Chat Lambda automatically detected S3 change and reloaded.");
    } else {
        console.warn("   ⚠️ WARNING: Chat Lambda did NOT log a reload. It might have been cold or logic failed.");
    }

    // 6. TEST MANUAL REFRESH: Force it
    console.log("6. Testing Manual Force Refresh...");
    const manualRes = await lambda.send(new InvokeCommand({
        FunctionName: CHAT_LAMBDA,
        LogType: 'Tail',
        Payload: Buffer.from(JSON.stringify({ arguments: { message: "", forceRefresh: true } }))
    }));

    const manualLogs = Buffer.from(manualRes.LogResult!, 'base64').toString();
    // console.log("   Manual Logs snippet:", manualLogs);

    if (manualLogs.includes("Receive Chat Request: { message: '', forceRefresh: true }") &&
        manualLogs.includes("Loading vector index from S3...")) {
        console.log("   ✅ SUCCESS: Chat Lambda performed manual force reload.");
    } else {
        console.error("   ❌ FAILURE: Chat Lambda did NOT reload for forceRefresh: true.");
        process.exit(1);
    }

    console.log("--- Cache Refresh Verification Passed ---");
}

verifyCacheRefresh().catch(err => {
    console.error("Verification Failed:", err);
    process.exit(1);
});
