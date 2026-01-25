import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";

const REGION = process.env.AWS_REGION || "us-east-1";

let _client: BedrockRuntimeClient | null = null;

function getClient() {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        sessionToken: process.env.AWS_SESSION_TOKEN || undefined,
      },
    });
  }
  return _client;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates embeddings using AWS Bedrock Titan Embeddings V2
 * V2 is ~5x faster with comparable quality to V1
 * Supports configurable dimensions: 256, 384, 512, 1024 (default)
 * Includes retry logic with exponential backoff for throttling
 */
export async function generateEmbedding(
  text: string,
  options?: { maxRetries?: number; initialDelay?: number; dimensions?: number }
): Promise<number[]> {
  // Skip if AWS not configured
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn("⚠️ AWS credentials not configured - skipping embedding generation");
    return [];
  }

  const maxRetries = options?.maxRetries ?? 5;
  const initialDelay = options?.initialDelay ?? 500;
  const dimensions = options?.dimensions ?? 1024; // V2 default, good balance of quality/speed

  // Use Titan Embeddings V2 - faster and more efficient
  const modelId = process.env.BEDROCK_EMBEDDING_MODEL_ID || "amazon.titan-embed-text-v2:0";
  const isV2 = modelId.includes('v2');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // V2 uses different payload format with dimensions parameter
      const payload = isV2 ? {
        inputText: text.replace(/\n/g, ' ').slice(0, 8000),
        dimensions: dimensions,
        normalize: true // Better for similarity search
      } : {
        inputText: text.replace(/\n/g, ' ').slice(0, 8000)
      };

      const command = new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload)
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Embedding timeout')), 15000)
      );

      const response = await Promise.race([
        getClient().send(command),
        timeoutPromise
      ]);

      // Parse response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      return responseBody.embedding || [];
    } catch (error: unknown) {
      const isThrottling = error instanceof Error &&
        (error.name === 'ThrottlingException' || error.message.includes('Too many requests'));

      if (isThrottling && attempt < maxRetries) {
        // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[Bedrock] Throttled, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("AWS Bedrock Embedding Error:", {
        error: errorMessage,
        attempt: attempt + 1,
        maxRetries,
        textLength: text.length,
        warning: "⚠️ MEMORY INJECTION WILL FAIL - embeddings not generated"
      });
      // Return empty on failure to not block chat, but log clearly
      return [];
    }
  }

  console.warn("⚠️ Embedding generation exhausted all retries - memory context will be missing");
  return [];
}

/**
 * Batch generate embeddings with rate limiting
 * Processes in small batches with delays to avoid throttling
 */
export async function generateEmbeddings(
  texts: string[],
  options?: { concurrency?: number; delayBetweenBatches?: number }
): Promise<number[][]> {
  const concurrency = options?.concurrency ?? 3; // Process 3 at a time
  const delayBetweenBatches = options?.delayBetweenBatches ?? 200; // 200ms between batches

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );
    results.push(...batchResults);

    // Add delay between batches to avoid throttling
    if (i + concurrency < texts.length) {
      await sleep(delayBetweenBatches);
    }
  }

  return results;
}
