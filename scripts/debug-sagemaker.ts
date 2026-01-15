import { SageMakerClient, ListEndpointsCommand } from "@aws-sdk/client-sagemaker";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listEndpoints() {
    console.log("🔍 Checking for SageMaker Endpoints in us-east-1...");

    const client = new SageMakerClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
    });

    try {
        const command = new ListEndpointsCommand({});
        const response = await client.send(command);

        console.log(`Found ${response.Endpoints?.length || 0} endpoints:`);
        response.Endpoints?.forEach(ep => {
            console.log(`- Name: ${ep.EndpointName} | Status: ${ep.EndpointStatus}`);
        });

        if (!response.Endpoints?.length) {
            console.log("⚠️  No endpoints found. You likely need to create/deploy one.");
        }
    } catch (error: any) {
        console.error("❌ Failed to list endpoints:", error);
    }
}

listEndpoints();
