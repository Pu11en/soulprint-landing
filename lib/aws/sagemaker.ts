import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import {
  SageMakerClient,
  CreateModelCommand,
  CreateEndpointConfigCommand,
  CreateEndpointCommand,
  DeleteEndpointCommand,
  DeleteEndpointConfigCommand,
  DeleteModelCommand,
  DescribeEndpointCommand,
} from '@aws-sdk/client-sagemaker';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SageMakerChatOptions {
  temperature?: number;
  maxTokens?: number;
}

const runtimeClient = new SageMakerRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const sagemakerClient = new SageMakerClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const ENDPOINT_NAME = process.env.SAGEMAKER_ENDPOINT_NAME || 'soulprint-llm';
const MODEL_NAME = 'soulprint-llm-model';
const ENDPOINT_CONFIG_NAME = 'soulprint-llm-config';

/**
 * Format messages into a chat prompt for the LLM
 */
function formatPrompt(messages: ChatMessage[]): string {
  let prompt = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      prompt += `<|im_start|>system\n${msg.content}<|im_end|>\n`;
    } else if (msg.role === 'user') {
      prompt += `<|im_start|>user\n${msg.content}<|im_end|>\n`;
    } else if (msg.role === 'assistant') {
      prompt += `<|im_start|>assistant\n${msg.content}<|im_end|>\n`;
    }
  }

  // Add assistant prefix for response
  prompt += '<|im_start|>assistant\n';

  return prompt;
}

/**
 * Invoke the SageMaker endpoint with chat messages
 */
export async function invokeSageMaker(
  messages: ChatMessage[],
  options: SageMakerChatOptions = {}
): Promise<string> {
  const { temperature = 0.7, maxTokens = 512 } = options;

  const prompt = formatPrompt(messages);

  const payload = {
    inputs: prompt,
    parameters: {
      max_new_tokens: maxTokens,
      temperature: temperature,
      do_sample: true,
      stop: ['<|im_end|>'],
    },
  };

  const command = new InvokeEndpointCommand({
    EndpointName: ENDPOINT_NAME,
    ContentType: 'application/json',
    Body: JSON.stringify(payload),
  });

  const response = await runtimeClient.send(command);

  if (!response.Body) {
    throw new Error('Empty response from SageMaker');
  }

  const responseText = new TextDecoder().decode(response.Body);
  const result = JSON.parse(responseText);

  // Handle different response formats from LMI container
  if (Array.isArray(result)) {
    return result[0]?.generated_text || '';
  } else if (result.generated_text) {
    return result.generated_text;
  } else if (typeof result === 'string') {
    return result;
  }

  throw new Error('Unexpected response format from SageMaker');
}

/**
 * Check if the SageMaker endpoint is running
 */
export async function checkEndpointStatus(): Promise<{
  status: string;
  isReady: boolean;
}> {
  try {
    const command = new DescribeEndpointCommand({
      EndpointName: ENDPOINT_NAME,
    });

    const response = await sagemakerClient.send(command);
    const status = response.EndpointStatus || 'Unknown';

    return {
      status,
      isReady: status === 'InService',
    };
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      return { status: 'NotFound', isReady: false };
    }
    throw error;
  }
}

/**
 * Deploy the LLM model to SageMaker
 * Note: This takes 10-15 minutes to spin up
 */
export async function deployModel(): Promise<void> {
  const region = process.env.AWS_REGION || 'us-east-1';

  // LMI container with vLLM
  const imageUri = `763104351884.dkr.ecr.${region}.amazonaws.com/djl-inference:0.28.0-lmi11.0.0-cu124`;

  // Create model
  await sagemakerClient.send(new CreateModelCommand({
    ModelName: MODEL_NAME,
    PrimaryContainer: {
      Image: imageUri,
      Environment: {
        HF_MODEL_ID: 'NousResearch/Hermes-2-Pro-Llama-3-8B',
        OPTION_ROLLING_BATCH: 'vllm',
        TENSOR_PARALLEL_DEGREE: '1',
        OPTION_MAX_ROLLING_BATCH_SIZE: '4',
        OPTION_DTYPE: 'fp16',
      },
    },
    ExecutionRoleArn: process.env.SAGEMAKER_EXECUTION_ROLE_ARN!,
  }));

  // Create endpoint config
  await sagemakerClient.send(new CreateEndpointConfigCommand({
    EndpointConfigName: ENDPOINT_CONFIG_NAME,
    ProductionVariants: [
      {
        VariantName: 'primary',
        ModelName: MODEL_NAME,
        InitialInstanceCount: 1,
        InstanceType: 'ml.g5.xlarge',
      },
    ],
  }));

  // Create endpoint
  await sagemakerClient.send(new CreateEndpointCommand({
    EndpointName: ENDPOINT_NAME,
    EndpointConfigName: ENDPOINT_CONFIG_NAME,
  }));

  console.log(`Endpoint ${ENDPOINT_NAME} is being created. This takes 10-15 minutes.`);
}

/**
 * Delete the SageMaker endpoint (to save costs)
 */
export async function deleteEndpoint(): Promise<void> {
  try {
    await sagemakerClient.send(new DeleteEndpointCommand({
      EndpointName: ENDPOINT_NAME,
    }));

    await sagemakerClient.send(new DeleteEndpointConfigCommand({
      EndpointConfigName: ENDPOINT_CONFIG_NAME,
    }));

    await sagemakerClient.send(new DeleteModelCommand({
      ModelName: MODEL_NAME,
    }));

    console.log(`Endpoint ${ENDPOINT_NAME} deleted successfully.`);
  } catch (error: any) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }
}
