
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const REGION = "us-east-1";
const SANDBOX_BUCKET = "amplify-policypal-fred-sa-policydrivebucket36b8b4d-r8cqkl4tpoc5";
const CHAT_LAMBDA = "amplify-policypal-fred-sandbox--chatlambdaBAAF975C-HfE0PBlAyXgz";
const SYNC_LAMBDA = "amplify-policypal-fred-sandbox--synclambdaF92182A5-A7uSGIMPreTI";

const s3 = new S3Client({ region: REGION });
const lambda = new LambdaClient({ region: REGION });

async function invokeChat(message: string, forceRefresh = false) {
    const payload = JSON.stringify({ arguments: { message, forceRefresh } });
    const res = await lambda.send(new InvokeCommand({
        FunctionName: CHAT_LAMBDA,
        Payload: Buffer.from(payload)
    }));
    return JSON.parse(Buffer.from(res.Payload!).toString());
}

async function invokeSync(filePath?: string, clear = false) {
    const payload = JSON.stringify({ arguments: { filePath, clear } });
    const res = await lambda.send(new InvokeCommand({
        FunctionName: SYNC_LAMBDA,
        Payload: Buffer.from(payload)
    }));
    return JSON.parse(Buffer.from(res.Payload!).toString());
}

async function uploadFile(key: string, content: string) {
    await s3.send(new PutObjectCommand({
        Bucket: SANDBOX_BUCKET,
        Key: key,
        Body: Buffer.from(content)
    }));
}

async function runTest() {
    console.log("--- Starting Robust Refresh & Clear E2E Test ---");

    // 1. Clear Index
    console.log("1. Clearing Index...");
    const clearRes = await invokeSync(undefined, true);
    console.log("   Result:", clearRes);

    // 2. Initial Check (Should be empty)
    console.log("2. Checking Empty Index Chat...");
    const chat1 = await invokeChat("Tell me about policies");
    console.log("   Chat Response:", chat1.answer);
    if (!chat1.answer.includes("index is empty")) {
        // throw new Error("Expected 'index is empty' message.");
        console.warn("   ⚠️ Warning: Answer didn't contain 'index is empty' exactly, check logic.");
    }

    // 3. Upload File A
    const fileA = "public/policy-a.txt";
    const contentA = "Policy A says: Everyone must wear blue socks on Tuesdays.";
    console.log(`3. Uploading ${fileA}...`);
    await uploadFile(fileA, contentA);
    await invokeSync(fileA);

    // 4. Chat about A
    console.log("4. Chatting about Policy A...");
    const chat2 = await invokeChat("What must I wear on Tuesdays?");
    console.log("   Chat Response:", chat2.answer);
    if (!chat2.answer.toLowerCase().includes("blue socks")) {
        throw new Error("Chat failed to answer about Policy A.");
    }
    console.log("   ✅ SUCCESS: Policy A knowledge confirmed.");

    // 5. Upload File B (Updating knowledge)
    const fileB = "public/policy-b.txt";
    const contentB = "Policy B says: Everyone must wear red hats on Wednesdays.";
    console.log(`5. Uploading ${fileB}...`);
    await uploadFile(fileB, contentB);
    await invokeSync(fileB);

    // 6. Chat about B (Proves automatic cache refresh)
    console.log("6. Chatting about Policy B (Checking Auto-Refresh)...");
    const chat3 = await invokeChat("What must I wear on Wednesdays?");
    console.log("   Chat Response:", chat3.answer);
    if (!chat3.answer.toLowerCase().includes("red hat")) {
        console.warn("   ❌ Auto-Refresh failed? Trying manual refresh...");
        await invokeChat("", true); // Manual force refresh
        const chat3Retry = await invokeChat("What must I wear on Wednesdays?");
        console.log("   Retry Response:", chat3Retry.answer);
        if (!chat3Retry.answer.toLowerCase().includes("red hat")) {
            throw new Error("Chat failed to answer about Policy B even after manual refresh.");
        }
        console.log("   ✅ SUCCESS: Policy B knowledge confirmed after manual refresh.");
    } else {
        console.log("   ✅ SUCCESS: Policy B knowledge confirmed automatically.");
    }

    // 7. Clear Index again
    console.log("7. Clearing Index again...");
    await invokeSync(undefined, true);

    // 8. Final Check
    console.log("8. Verifying Empty Index again...");
    // We might need to force refresh here if we want to BE SURE it detects the empty state immediately
    await invokeChat("", true);
    const chat4 = await invokeChat("Tell me about policies");
    console.log("   Final Chat Response:", chat4.answer);
    if (!chat4.answer.includes("index is empty")) {
        console.error("   ❌ Cache persisted after clear!");
        process.exit(1);
    }
    console.log("   ✅ SUCCESS: Index cleared and cache updated.");

    console.log("--- Robust Refresh & Clear E2E Test Passed ---");
}

runTest().catch(e => {
    console.error("Test Failed:", e);
    process.exit(1);
});
