// Quick Bedrock test - run with: node test-bedrock.mjs
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const modelId = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-haiku-20241022-v1:0";

async function testBedrock() {
  console.log("Testing Bedrock with model:", modelId);
  console.log("Region:", process.env.AWS_REGION || "us-east-1");
  
  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: "Say hello and confirm you are Claude running on AWS Bedrock. Keep it brief."
      }
    ]
  };

  try {
    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const result = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log("\n✅ SUCCESS! Response:");
    console.log(result.content[0].text);
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    if (error.name === "AccessDeniedException") {
      console.log("\nTip: Make sure your IAM user has AmazonBedrockFullAccess policy");
    }
  }
}

testBedrock();
