import { invokeSoulPrintModel, invokeSoulPrintModelStream, ChatMessage } from '@/lib/aws/sagemaker';

export async function unifiedChatCompletion(messages: ChatMessage[], options: { model?: string } = {}) {
    void options;

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

export async function* unifiedStreamChatCompletion(messages: ChatMessage[], options: { model?: string } = {}) {
    void options;

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

    } catch (error: unknown) {
        console.error('❌ Streaming failed:', error);
        const message = error instanceof Error ? error.message : String(error);
        yield `[ERROR: ${message}]`;
    }
}
