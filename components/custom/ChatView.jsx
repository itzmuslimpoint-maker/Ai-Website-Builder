"use client"
import { MessagesContext } from '@/context/MessagesContext';
import { Loader2Icon, Send } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { useConvex } from 'convex/react';
import { useParams } from 'next/navigation';
import { useContext, useEffect, useState, useCallback, useRef, memo } from 'react';
import { useMutation } from 'convex/react';
import Prompt from '@/data/Prompt';
import ReactMarkdown from 'react-markdown';

const MessageItem = memo(({ msg }) => (
    <div
        className={`p-4 rounded-lg ${
            msg.role === 'user' 
                ? 'bg-gray-800/50 border border-gray-700' 
                : 'bg-gray-800/30 border border-gray-700'
        }`}
    >
        <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg text-xs font-bold ${
                msg.role === 'user' 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'bg-purple-500/20 text-purple-400'
            }`}>
                {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <ReactMarkdown className="prose prose-invert flex-1 overflow-auto text-sm">
                {msg.content}
            </ReactMarkdown>
        </div>
    </div>
));

MessageItem.displayName = 'MessageItem';

function ChatView() {
    const { id } = useParams();
    const convex = useConvex();
    const { messages, setMessages } = useContext(MessagesContext);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(false);
    const UpdateMessages = useMutation(api.workspace.UpdateWorkspace);
    const isGeneratingRef = useRef(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const GetWorkSpaceData = useCallback(async () => {
        try {
            const result = await convex.query(api.workspace.GetWorkspace, {
                workspaceId: id
            });
            setMessages(result?.messages || []);
        } catch (error) {
            console.error('Error fetching workspace:', error);
        }
    }, [id, convex, setMessages]);

    useEffect(() => {
        if (id) {
            GetWorkSpaceData();
        }
    }, [id, GetWorkSpaceData]);

    const GetAiResponse = useCallback(async (currentMessages) => {
        if (isGeneratingRef.current) return;
        isGeneratingRef.current = true;
        setLoading(true);
        
        const PROMPT = JSON.stringify(currentMessages) + Prompt.CHAT_PROMPT;
        
        try {
            const response = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: PROMPT }),
            });

            if (!response.ok) {
                throw new Error('Failed to get AI response');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            // Add placeholder AI message for streaming
            setMessages(prev => [...prev, { role: 'ai', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.chunk) {
                                fullText += data.chunk;
                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = { role: 'ai', content: fullText };
                                    return updated;
                                });
                            }
                            if (data.done && data.result) {
                                fullText = data.result;
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            // Save to database
            const finalMessages = [...currentMessages, { role: 'ai', content: fullText }];
            await UpdateMessages({
                messages: finalMessages,
                workspaceId: id
            });
        } catch (error) {
            console.error('Error getting AI response:', error);
            setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, there was an error generating a response. Please try again.' }]);
        } finally {
            setLoading(false);
            isGeneratingRef.current = false;
        }
    }, [id, UpdateMessages, setMessages]);

    useEffect(() => {
        if (messages?.length > 0 && !isGeneratingRef.current) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'user') {
                GetAiResponse(messages);
            }
        }
    }, [messages, GetAiResponse]);

    const onGenerate = useCallback((input) => {
        if (!input.trim() || loading) return;
        setMessages(prev => [...(prev || []), {
            role: 'user',
            content: input
        }]);
        setUserInput('');
    }, [setMessages, loading]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (userInput.trim()) {
                onGenerate(userInput);
            }
        }
    };

    return (
        <div className="relative h-[85vh] flex flex-col bg-gray-900 rounded-xl border border-gray-800">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
                <div className="max-w-4xl mx-auto space-y-4">
                    {!messages || messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full min-h-[200px]">
                            <p className="text-gray-500 text-center">
                                Start a conversation to build your website...
                            </p>
                        </div>
                    ) : (
                        Array.isArray(messages) && messages.map((msg, index) => (
                            <MessageItem key={index} msg={msg} />
                        ))
                    )}
                    
                    {loading && (
                        <div className="p-4 rounded-lg bg-gray-800/30 border border-gray-700">
                            <div className="flex items-center gap-3 text-gray-400">
                                <Loader2Icon className="animate-spin h-5 w-5" />
                                <p className="font-medium text-sm">Generating response...</p>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Section */}
            <div className="border-t border-gray-800 bg-gray-900/50 backdrop-blur-sm p-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex gap-3">
                        <textarea
                            placeholder="Type your message here..."
                            value={userInput}
                            onChange={(event) => setUserInput(event.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 resize-none h-24 disabled:opacity-50"
                        />
                        {userInput.trim() && (
                            <button
                                onClick={() => onGenerate(userInput)}
                                disabled={loading}
                                className="flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl px-4 transition-all duration-200 disabled:opacity-50"
                            >
                                <Send className="h-6 w-6 text-white" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ChatView;
