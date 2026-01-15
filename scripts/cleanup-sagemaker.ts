import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  SageMakerClient,
  DeleteEndpointCommand,
  DeleteEndpointConfigCommand,
  DeleteModelCommand,
  DescribeEndpointCommand,
  DescribeEndpointConfigCommand,
} from '@aws-sdk/client-sagemaker';

const client = new SageMakerClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME || 'soulprint-llm';
  console.log(`🧹 Cleaning up SageMaker resources for: ${endpointName}`);

  try {
    // 1. Describe Endpoint to find Config Name
    console.log('Finding resources...');

    // We need to use DescribeEndpoint to get the config name because it's dynamic
    /* 
       Note: If the endpoint is already deleted, we might orphan the config/model. 
       A robust script would list-configs and filter by name prefix, but for now 
       we will try the "happy path" of deleting down the tree.
    */

    let configName: string | undefined;

    try {
      const { EndpointConfigName } = await client.send(
        new DescribeEndpointCommand({ EndpointName: endpointName })
      );
      configName = EndpointConfigName;
      console.log(`target config: ${configName}`);
    } catch (e: any) {
      console.log(`Endpoint not found/readable: ${e.message}`);
    }

    // 2. Delete Endpoint (Stops billing immediately)
    if (configName || endpointName) {
      try {
        console.log('Deleting Endpoint...');
        await client.send(new DeleteEndpointCommand({ EndpointName: endpointName }));
        console.log('✅ Deleted Endpoint (Billing Stopped)');
      } catch (e: any) {
        console.log(`⚠️ Could not delete endpoint: ${e.message}`);
      }
    }

    if (!configName) {
      console.log('Skipping Config/Model cleanup (could not identify from endpoint)');
      return;
    }

    // 3. Find Model Name from Config
    let modelName: string | undefined;
    try {
      const { ProductionVariants } = await client.send(
        new DescribeEndpointConfigCommand({ EndpointConfigName: configName })
      );
      modelName = ProductionVariants?.[0]?.ModelName;
      console.log(`target model: ${modelName}`);
    } catch (e: any) {
      console.log(`Config not found: ${e.message}`);
    }

    // 4. Delete Config
    try {
      if (configName) {
        await client.send(new DeleteEndpointConfigCommand({ EndpointConfigName: configName }));
        console.log('✅ Deleted Endpoint Config');
      }
    } catch (e) { console.error(e); }

    // 5. Delete Model
    try {
      if (modelName) {
        await client.send(new DeleteModelCommand({ ModelName: modelName }));
        console.log('✅ Deleted Model');
      }
    } catch (e) { console.error(e); }

  } catch (error: any) {
    console.error('Cleanup failed:', error);
  }
}

main();
