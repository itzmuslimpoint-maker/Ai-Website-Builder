import { GenAiCode } from '@/configs/AiModel';

export async function POST(req) {
    const { prompt } = await req.json();

    if (!prompt) {
        return new Response(JSON.stringify({ error: 'Prompt is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const result = await GenAiCode.sendMessageStream(prompt);
        
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
                    // Send final complete response - parse the JSON
                    try {
                        // Clean up the response - remove markdown code blocks if present
                        let cleanText = fullText.trim();
                        if (cleanText.startsWith('```json')) {
                            cleanText = cleanText.slice(7);
                        } else if (cleanText.startsWith('```')) {
                            cleanText = cleanText.slice(3);
                        }
                        if (cleanText.endsWith('```')) {
                            cleanText = cleanText.slice(0, -3);
                        }
                        cleanText = cleanText.trim();

                        const parsedData = JSON.parse(cleanText);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({final: parsedData, done: true})}\n\n`));
                    } catch (e) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({error: 'Invalid JSON response from AI', raw: fullText.substring(0, 200), done: true})}\n\n`));
                    }
                    controller.close();
                } catch (e) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({error: e.message || 'Code generation failed'})}\n\n`));
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
    } catch(e) {
        return new Response(JSON.stringify({error: e.message || 'Code generation failed'}), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
