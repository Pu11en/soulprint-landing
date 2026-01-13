import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  SageMakerClient,
  DeleteEndpointCommand,
  DeleteEndpointConfigCommand,
  DeleteModelCommand,
} from '@aws-sdk/client-sagemaker';

const client = new SageMakerClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  console.log('🧹 Cleaning up SageMaker resources...');

  // Try to delete endpoint
  try {
    await client.send(new DeleteEndpointCommand({ EndpointName: 'soulprint-llm' }));
    console.log('Deleted endpoint');
  } catch (e: any) {
    console.log('Endpoint:', e.message?.slice(0, 50) || 'not found');
  }

  // Try to delete endpoint config
  try {
    await client.send(new DeleteEndpointConfigCommand({ EndpointConfigName: 'soulprint-llm-config' }));
    console.log('Deleted endpoint config');
  } catch (e: any) {
    console.log('Config:', e.message?.slice(0, 50) || 'not found');
  }

  // Try to delete model
  try {
    await client.send(new DeleteModelCommand({ ModelName: 'soulprint-llm-model' }));
    console.log('Deleted model');
  } catch (e: any) {
    console.log('Model:', e.message?.slice(0, 50) || 'not found');
  }

  console.log('✅ Cleanup complete');
}

main();
