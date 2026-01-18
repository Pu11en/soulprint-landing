import { SageMakerRuntimeClient, InvokeEndpointCommand, InvokeEndpointWithResponseStreamCommand } from "@aws-sdk/client-sagemaker-runtime";
import {
  SageMakerClient,
  DescribeEndpointCommand,
  CreateModelCommand,
  CreateEndpointConfigCommand,
  CreateEndpointCommand
} from "@aws-sdk/client-sagemaker";

const CONTROL_PLANE_REGION = process.env.AWS_REGION || "us-east-1";

let _runtimeClient: SageMakerRuntimeClient | null = null;
let _sagemakerClient: SageMakerClient | null = null;

function getRuntimeClient() {
  if (!_runtimeClient) {
    _runtimeClient = new SageMakerRuntimeClient({
      region: CONTROL_PLANE_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return _runtimeClient;
}

function getSagemakerClient() {
  if (!_sagemakerClient) {
    _sagemakerClient = new SageMakerClient({
      region: CONTROL_PLANE_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return _sagemakerClient;
}

export interface SageMakerResponse {
  body: string; // implementation dependent on the model container
  contentType: string;
}

/**
 * Invokes the configured SageMaker Endpoint (Non-Streaming).
 */
export async function invokeSoulPrintModel(
  payload: Record<string, unknown>
): Promise<Record<string, unknown> | string | { text: string }> {
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME;

  if (!endpointName) {
    throw new Error("SAGEMAKER_ENDPOINT_NAME is not defined in environment variables.");
  }

  const command = new InvokeEndpointCommand({
    EndpointName: endpointName,
    ContentType: "application/json",
    Body: Buffer.from(JSON.stringify(payload)),
  });

  try {
    const response = await getRuntimeClient().send(command);
    const responseBody = new TextDecoder("utf-8").decode(response.Body);

    try {
      return JSON.parse(responseBody);
    } catch {
      return { text: responseBody };
    }
  } catch (error: unknown) {
    console.error("AWS SageMaker Invocation Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SageMaker Invocation Failed: ${message}`);
  }
}

/**
 * Invokes the configured SageMaker Endpoint (Streaming).
 * Yields chunks of generated text.
 */
export async function* invokeSoulPrintModelStream(
  payload: Record<string, unknown>
): AsyncGenerator<string, void, unknown> {
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME;

  if (!endpointName) {
    throw new Error("SAGEMAKER_ENDPOINT_NAME is not defined in environment variables.");
  }

  const command = new InvokeEndpointWithResponseStreamCommand({
    EndpointName: endpointName,
    ContentType: "application/json",
    Body: Buffer.from(JSON.stringify(payload)),
  });

  try {
    const response = await getRuntimeClient().send(command);

    if (!response.Body) {
      throw new Error("No response body from SageMaker stream.");
    }

    const decoder = new TextDecoder("utf-8");
    for await (const chunk of response.Body) {
      if (chunk.PayloadPart && chunk.PayloadPart.Bytes) {
        const decodedChunk = decoder.decode(chunk.PayloadPart.Bytes);

        // Try to parse as structured data first
        try {
          const lines = decodedChunk.split('\n').filter(line => line.trim() !== '');
          for (const line of lines) {
            // SSE format: data: {...}
            if (line.startsWith('data:')) {
              const jsonStr = line.substring(5).trim();
              if (jsonStr === '[DONE]') continue;
              const data = JSON.parse(jsonStr);
              if (data.token?.text) {
                yield data.token.text;
              } else if (data.choices && data.choices[0]?.delta?.content) {
                yield data.choices[0].delta.content;
              } else if (typeof data === 'string') {
                yield data;
              }
            } else {
              // Try raw JSON parse
              const data = JSON.parse(line);
              if (data.token?.text) {
                yield data.token.text;
              } else if (data.generated_text) {
                // Non-streaming response format
                yield data.generated_text;
              } else if (typeof data === 'string') {
                yield data;
              }
            }
          }
        } catch {
          // Fallback: yield raw decoded text if parsing fails
          // This handles cases where TGI sends plain text
          if (decodedChunk.trim()) {
            console.log('[SageMaker Stream] Raw chunk (no JSON):', decodedChunk.slice(0, 100));
            yield decodedChunk;
          }
        }
      }
    }
  } catch (error: unknown) {
    console.error("AWS SageMaker Streaming Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SageMaker Streaming Failed: ${message}`);
  }
}

/**
 * Checks the status of the configured endpoint.
 */
export async function checkEndpointStatus() {
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME;
  if (!endpointName) return { isReady: false, status: 'Missing Config' };

  try {
    const command = new DescribeEndpointCommand({ EndpointName: endpointName });
    const response = await getSagemakerClient().send(command);

    return {
      isReady: response.EndpointStatus === 'InService',
      status: response.EndpointStatus
    };
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === 'ValidationError' || err.message?.includes('Could not find endpoint')) {
      return { isReady: false, status: 'NotFound' };
    }
    throw error;
  }
}

/**
 * Deploys the Hermes-2-Pro-Llama-3 model using Hugging Face TGI container.
 */
export async function deployModel() {
  const endpointName = process.env.SAGEMAKER_ENDPOINT_NAME!;
  const roleArn = process.env.SAGEMAKER_EXECUTION_ROLE_ARN!;

  // 1. Create Model
  // Using TGI 2.0.1 image for us-east-1
  const imageUri = "763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-tgi-inference:2.1.1-tgi2.0.0-gpu-py310-cu121-ubuntu22.04";
  const modelName = `${endpointName}-model-${Date.now()}`;

  console.log("Creating Model...");
  await getSagemakerClient().send(new CreateModelCommand({
    ModelName: modelName,
    ExecutionRoleArn: roleArn,
    PrimaryContainer: {
      Image: imageUri,
      Environment: {
        "HF_MODEL_ID": "NousResearch/Hermes-2-Pro-Llama-3-8B",
        "SM_NUM_GPUS": "1",
        "MAX_INPUT_LENGTH": "1024",
        "MAX_TOTAL_TOKENS": "2048",
      }
    }
  }));

  // 2. Create Endpoint Config
  const configName = `${endpointName}-config-${Date.now()}`;
  console.log("Creating Endpoint Config...");
  await getSagemakerClient().send(new CreateEndpointConfigCommand({
    EndpointConfigName: configName,
    ProductionVariants: [
      {
        VariantName: "AllTraffic",
        ModelName: modelName,
        InitialInstanceCount: 1,
        InstanceType: "ml.g5.xlarge", // ~$1.00/hr
      }
    ]
  }));

  // 3. Create Endpoint
  console.log(`Creating Endpoint ${endpointName}...`);
  await getSagemakerClient().send(new CreateEndpointCommand({
    EndpointName: endpointName,
    EndpointConfigName: configName
  }));
}

// ChatMessage type for API compatibility
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Invokes SageMaker for chat completions (ChatMessage[] format).
 * Formats messages for Hermes 3 Pro (ChatML format).
 */
export async function invokeSageMaker(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  // Format messages in ChatML format for Hermes 3 Pro
  let prompt = "";
  for (const m of messages) {
    prompt += `<|im_start|>${m.role}\n${m.content}\n<|im_end|>\n`;
  }
  prompt += "<|im_start|>assistant\n";

  const response = await invokeSoulPrintModel({
    inputs: prompt,
    parameters: {
      max_new_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      details: false
    }
  });

  // Parse TGI Response: [{ generated_text: "..." }]
  if (Array.isArray(response) && response[0]?.generated_text) {
    let text = response[0].generated_text;
    // If prompt is echoed, strip it
    if (text.startsWith(prompt)) {
      text = text.substring(prompt.length);
    }
    return text.trim();
  }

  // Fallback for different response shapes
  return typeof response === 'string' ? response : JSON.stringify(response);
}

