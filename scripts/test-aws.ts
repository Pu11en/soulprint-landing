import dotenv from 'dotenv';
import { invokeSoulPrintModel } from '../lib/aws/sagemaker';

// Load env vars
dotenv.config({ path: '.env.local' });

async function main() {
    console.log("Testing AWS SageMaker Connection...");
    console.log(`Endpoint: ${process.env.SAGEMAKER_ENDPOINT_NAME}`);
    console.log(`Region: ${process.env.AWS_REGION}`);

    try {
        // Simple test payload - adjust based on your specific model's expectations
        // Common Llama format or generic prompt
        const payload = {
            inputs: "Hello, are you online? Please reply with 'Yes'.",
            parameters: {
                max_new_tokens: 20,
                temperature: 0.1
            }
        };

        const result = await invokeSoulPrintModel(payload);
        console.log("✅ Success! Response:");
        console.log(JSON.stringify(result, null, 2));

    } catch (error: any) {
        console.error("❌ Failed:", error);
        const fs = require('fs');
        fs.writeFileSync('aws-error.log', `Error: ${error.message}\nStack: ${error.stack}\nFull: ${JSON.stringify(error, null, 2)}`);
    }
}

main();
