import { chatSession } from "@/configs/AiModel";
import Prompt from "@/data/Prompt";

export async function POST(request) {
    try {
        const { prompt } = await request.json();
        
        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Prompt is required', success: false }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const fullPrompt = `${Prompt.ENHANCE_PROMPT_RULES}\n\nOriginal prompt: ${prompt}`;
        const result = await chatSession.sendMessageStream(fullPrompt);
        
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let fullText = '';
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        fullText += chunkText;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({chunk: chunkText})}\n\n`));
                    }
                    // Send final complete response
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({enhancedPrompt: fullText.trim(), done: true})}\n\n`));
                    controller.close();
                } catch (e) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({error: e.message, success: false})}\n\n`));
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: error.message,
            success: false 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
