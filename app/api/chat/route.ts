import { bedrock } from "@ai-sdk/amazon-bedrock";
import { streamText, convertToModelMessages, UIMessage } from "ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: bedrock(process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-haiku-4-5-20251001-v1:0"),
    messages: await convertToModelMessages(messages),
    system: `You are a helpful AI companion called SoulPrint. Be friendly, warm, and conversational. Keep responses concise but helpful.`,
  });

  return result.toUIMessageStreamResponse();
}
