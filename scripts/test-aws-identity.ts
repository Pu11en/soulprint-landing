import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkIdentity() {
    console.log("🔍 Testing AWS Access Keys via STS (Identity Check)...");
    console.log(`Using Key ID: ${process.env.AWS_ACCESS_KEY_ID?.substring(0, 8)}...`);
    console.log(`Region: ${process.env.AWS_REGION}`);

    const client = new STSClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
    });

    try {
        const command = new GetCallerIdentityCommand({});
        const response = await client.send(command);
        console.log("✅ SUCCESS! Credentials are Valid.");
        console.log("Account:", response.Account);
        console.log("ARN:", response.Arn);
        console.log("User ID:", response.UserId);
    } catch (error: any) {
        console.error("❌ FAILURE: Credentials Rejected.");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
    }
}

checkIdentity();
