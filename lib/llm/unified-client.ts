import { invokeSoulPrintModel, invokeSoulPrintModelStream } from '@/lib/aws/sagemaker';
// import { chatCompletion as openAIChat, streamChatCompletion as openAIStream, ChatMessage } from '@/lib/openai/client';

export async function unifiedChatCompletion(messages: any[], options: { model?: string } = {}) {
    console.log('🚀 Using AWS SageMaker LLM');

    try {
        // Construct prompt (ChatML or raw)
        let prompt = "";
        for (const m of messages) {
            prompt += `<|im_start|>${m.role}\n${m.content}\n<|im_end|>\n`;
        }
        prompt += "<|im_start|>assistant\n";

        const response = await invokeSoulPrintModel({
            inputs: prompt,
            parameters: {
                max_new_tokens: 1024,
                temperature: 0.7,
                details: false
            }
        });

        if (Array.isArray(response) && response[0]?.generated_text) {
            let text = response[0].generated_text;
            if (text.startsWith(prompt)) {
                text = text.substring(prompt.length);
            }
            return text.trim();
        }

        return typeof response === 'string' ? response : JSON.stringify(response);

    } catch (error) {
        console.error('❌ SageMaker failed:', error);
        throw error;
    }
}

export async function* unifiedStreamChatCompletion(messages: any[], options: { model?: string } = {}) {
    console.log('🚀 Using AWS SageMaker LLM (Streaming)');

    // Construct Prompt
    let prompt = "";
    for (const m of messages) {
        prompt += `<|im_start|>${m.role}\n${m.content}\n<|im_end|>\n`;
    }
    prompt += "<|im_start|>assistant\n";

    try {
        // Use Real Streaming via AWS SDK
        const stream = invokeSoulPrintModelStream({
            inputs: prompt,
            parameters: {
                max_new_tokens: 1024,
                temperature: 0.7,
                details: false // TGI param to just get tokens
            },
            stream: true // TGI often needs explicit flag
        });

        for await (const chunk of stream) {
            yield chunk;
        }

    } catch (error: any) {
        console.error('❌ Streaming failed:', error);
        yield `[ERROR: ${error.message}]`;
    }
}
