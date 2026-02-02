
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import * as fs from 'fs';
import { createRequire } from 'module';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);

const REGION = "us-east-1";
const SANDBOX_BUCKET = "amplify-policypal-fred-sa-policydrivebucket36b8b4d-r8cqkl4tpoc5";
const SYNC_LAMBDA = "amplify-policypal-fred-sandbox--synclambdaF92182A5-A7uSGIMPreTI";
const SOURCE_BUCKET = "amplify-d23ogxrox7vzgq-ma-policydrivebucket36b8b4d-wq0baciwrpo2";
const FILE_KEY = "public/Acceptable Use Policy (AUP).pdf";
const TEST_KEY = "public/e2e-test-aup.pdf";

// Profile setup usually implicit in environment or via CLI running this script
// Start clients
const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

async function runE2E() {
    console.log("Starting Real E2E Test...");

    // 1. Download Source File
    console.log(`Downloading source file from ${SOURCE_BUCKET}/${FILE_KEY}...`);
    try {
        // Use CLI to grab the file using the specific profile to ensure access to source bucket
        execSync(`aws s3 cp "s3://${SOURCE_BUCKET}/${FILE_KEY}" temp_test.pdf --profile AdministratorAccess-520477993393`);
    } catch (e) {
        console.error("Failed to download source file. Ensure profile is valid.");
        process.exit(1);
    }

    const fileBuffer = fs.readFileSync('temp_test.pdf');

    // 2. Upload to Sandbox S3
    console.log(`Uploading to Sandbox S3: ${SANDBOX_BUCKET}/${TEST_KEY}...`);
    await s3.send(new PutObjectCommand({
        Bucket: SANDBOX_BUCKET,
        Key: TEST_KEY,
        Body: fileBuffer
    }));

    // 3. Invoke Lambda (Simulate AppSync Trigger)
    console.log("Invoking Sync Lambda...");
    const payload = JSON.stringify({
        arguments: { filePath: TEST_KEY }
    });

    // We assume the user's running environment has credentials for the Sandbox account
    const command = new InvokeCommand({
        FunctionName: SYNC_LAMBDA,
        Payload: Buffer.from(payload)
    });

    const response = await lambda.send(command);
    if (!response.Payload) {
        throw new Error("No payload returned from Lambda");
    }

    const resultFunc = JSON.parse(Buffer.from(response.Payload).toString());
    console.log("Lambda Response:", resultFunc);

    if (resultFunc.errorMessage) {
        console.error("Lambda Crashed:", resultFunc);
        process.exit(1);
    }

    if (resultFunc.success === false) {
        console.error("Lambda reported logic failure:", resultFunc.message);
        process.exit(1);
    }

    // 4. Verify Index
    console.log("Verifying Index in S3...");
    const getIndex = new GetObjectCommand({
        Bucket: SANDBOX_BUCKET,
        Key: 'vectors/index.json'
    });

    try {
        const indexRes = await s3.send(getIndex);
        const indexBody = await indexRes.Body!.transformToString();
        const indexData = JSON.parse(indexBody);

        const match = indexData.find((d: any) => d.path === TEST_KEY);

        // Also look for "file_marker"
        const marker = indexData.find((d: any) => d.path === TEST_KEY && d.metadata?.type === 'file_marker');

        if (match) {
            console.log("✅ SUCCESS: File content found in index!");
            console.log(`Text Length: ${match.text.length}`);
            console.log("Sample Text:", match.text.substring(0, 100).replace(/\n/g, ' '));
        } else {
            console.error("❌ FAILURE: File content NOT found in index.");
            // console.log("Index contains paths:", indexData.map((d: any) => d.path)); // Verbose
            process.exit(1);
        }

        if (marker) {
            console.log("✅ SUCCESS: File completion marker found!");
        } else {
            console.warn("⚠️ WARNING: content found but completion marker missing?");
        }

    } catch (e) {
        console.error("Failed to read index:", e);
        process.exit(1);
    }

    // Cleanup
    console.log("Cleaning up temp file...");
    fs.unlinkSync('temp_test.pdf');
    console.log("E2E Test Passed.");
}

runE2E();
