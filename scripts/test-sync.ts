
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand, GetFunctionConfigurationCommand } from "@aws-sdk/client-lambda";

// Configuration
const REGION = "us-east-1";
// From the `aws s3 ls` output, this looks like the correct bucket for the current sandbox "policypal-fred-sa"
const BUCKET_NAME = "amplify-policypal-fred-sa-policydrivebucket36b8b4d-r8cqkl4tpoc5";
// From the `aws lambda list-functions` output
const FUNCTION_NAME = "amplify-policypal-fred-sandbox--synclambdaF92182A5-A7uSGIMPreTI";

const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

async function runTest() {
    console.log("=== Starting Sync Proof Test ===");
    console.log(`Bucket: ${BUCKET_NAME}`);
    console.log(`Function: ${FUNCTION_NAME}`);

    // 1. Inspect Lambda Configuration
    console.log("\n1. Verifying Lambda Configuration...");
    const config = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: FUNCTION_NAME }));
    console.log(`   - Memory: ${config.MemorySize} MB`);
    console.log(`   - Timeout: ${config.Timeout} seconds`);

    if (config.MemorySize! < 2048) console.warn("   ⚠️ WARNING: Memory is less than 2048MB. Upgrade recommended.");
    else console.log("   ✅ Memory configuration is optimal.");

    // 2. Upload Test PDF (or use existing)
    // Testing the exact filename the user reported issues with.
    // Note: Since this is a dummy file (text content), pdf-parse will likely fail fast, which is a valid test of the error handling.
    const TEST_FILE_KEY = "public/Data Retention and Disposal Policy.pdf";
    console.log(`\n2. Checking Target File: ${TEST_FILE_KEY}`);

    try {
        await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: TEST_FILE_KEY }));
        console.log(`   ✅ File exists in S3.`);
    } catch (e) {
        console.error(`   ❌ File not found in S3. Please upload it first.`);
        return;
    }

    // 3. Clear existing index for this file (simulate fresh start)
    // We assume the handler typically cleans up, but let's see if we can check the index first.
    console.log("\n3. Triggering Sync (Direct Lambda Invoke)...");
    console.log("   This mimics the 'Sync' button click for a specific file.");

    const startTime = Date.now();

    const payload = {
        arguments: {
            filePath: TEST_FILE_KEY
        }
    };

    try {
        const invokeCmd = new InvokeCommand({
            FunctionName: FUNCTION_NAME,
            Payload: JSON.stringify(payload),
        });

        const result = await lambda.send(invokeCmd);
        const duration = (Date.now() - startTime) / 1000;

        const responsePayload = JSON.parse(new TextDecoder().decode(result.Payload));

        console.log(`\n4. Sync Execution Result (${duration.toFixed(2)}s):`);
        console.log(JSON.stringify(responsePayload, null, 2));

        if (responsePayload.success) {
            console.log("\n   ✅ SUCCESS: Lambda executed successfully without timeout.");
        } else {
            console.error("\n   ❌ FAILURE: Lambda returned error.");
        }

    } catch (e) {
        console.error("\n   ❌ FAILURE: Error invoking Lambda:", e);
    }

    // 5. Verify Index Content
    console.log("\n5. Verifying Index Content...");
    try {
        const getIndex = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: "vectors/index.json" });
        const res = await s3.send(getIndex);
        const body = await res.Body?.transformToString();
        const index = JSON.parse(body || "[]");

        const chunks = index.filter((d: any) => d.path === TEST_FILE_KEY);
        console.log(`   Found ${chunks.length} chunks for ${TEST_FILE_KEY} in index.`);

        const marker = chunks.find((d: any) => d.metadata?.type === 'file_marker');
        if (marker) {
            console.log("   ✅ Completion Marker FOUND. File is fully indexed.");
        } else {
            console.error("   ❌ Completion Marker MISSING. File is incomplete/corrupt.");
        }

    } catch (e) {
        console.error("   ❌ Error reading index:", e);
    }
}

runTest();
