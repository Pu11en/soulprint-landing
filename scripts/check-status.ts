import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  SageMakerClient,
  DescribeEndpointCommand,
} from '@aws-sdk/client-sagemaker';

const client = new SageMakerClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  try {
    const response = await client.send(new DescribeEndpointCommand({
      EndpointName: 'soulprint-llm',
    }));

    console.log('Status:', response.EndpointStatus);
    if (response.FailureReason) {
      console.log('Failure reason:', response.FailureReason);
    }
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

main();
