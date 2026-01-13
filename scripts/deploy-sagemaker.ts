import { config } from 'dotenv';
config({ path: '.env.local' });

import { deployModel, checkEndpointStatus } from '../lib/aws/sagemaker';

async function main() {
  console.log('🚀 Starting SageMaker deployment...');
  console.log('Model: NousResearch/Hermes-2-Pro-Llama-3-8B');
  console.log('Instance: ml.g5.xlarge (~$1/hour)');
  console.log('');

  try {
    // Check if already deployed
    const status = await checkEndpointStatus();
    if (status.isReady) {
      console.log('✅ Endpoint already running!');
      return;
    }
    if (status.status === 'Creating' || status.status === 'Updating') {
      console.log(`⏳ Endpoint is ${status.status}... wait 10-15 minutes`);
      return;
    }

    console.log('Creating endpoint... this takes 10-15 minutes.');
    console.log('');

    await deployModel();

    console.log('');
    console.log('✅ Deployment started!');
    console.log('');
    console.log('Run this script again to check status, or check AWS Console:');
    console.log('SageMaker → Inference → Endpoints');

  } catch (error: any) {
    console.error('❌ Deployment failed:', error.message);

    if (error.message?.includes('ResourceLimitExceeded')) {
      console.log('');
      console.log('You need to request a quota increase for ml.g5.xlarge');
    }
  }
}

main();
