"use client"
import React, { useContext, useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Lookup from '@/data/Lookup';
import { MessagesContext } from '@/context/MessagesContext';
import Prompt from '@/data/Prompt';
import { useParams } from 'next/navigation';
import { Loader2Icon, Download } from 'lucide-react';
import JSZip from 'jszip';

const SandpackProvider = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackProvider), { ssr: false });
const SandpackLayout = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackLayout), { ssr: false });
const SandpackCodeEditor = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackCodeEditor), { ssr: false });
const SandpackPreview = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackPreview), { ssr: false });
const SandpackFileExplorer = dynamic(() => import("@codesandbox/sandpack-react").then(mod => mod.SandpackFileExplorer), { ssr: false });

function CodeView() {
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('code');
    const [files, setFiles] = useState(Lookup?.DEFAULT_FILE);
    const { messages } = useContext(MessagesContext);
    const [loading, setLoading] = useState(false);
    const isGeneratingRef = useRef(false);

    const preprocessFiles = useCallback((files) => {
        const processed = {};
        Object.entries(files).forEach(([path, content]) => {
            if (typeof content === 'string') {
                processed[path] = { code: content };
            } else if (content && typeof content === 'object') {
                if (content.code) {
                    processed[path] = { code: content.code };
                } else {
                    processed[path] = { code: JSON.stringify(content, null, 2) };
                }
            }
        });
        return processed;
    }, []);

    // Load files from localStorage on mount
    useEffect(() => {
        if (id && typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(`workspace_${id}`);
                if (stored) {
                    const workspace = JSON.parse(stored);
                    if (workspace.files) {
                        const processedFiles = preprocessFiles(workspace.files);
                        const mergedFiles = { ...Lookup.DEFAULT_FILE, ...processedFiles };
                        setFiles(mergedFiles);
                    }
                }
            } catch (error) {
                console.error('Error loading files:', error);
            }
        }
    }, [id, preprocessFiles]);

    // Persist files to localStorage
    const persistFiles = useCallback((fileData) => {
        if (id && typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(`workspace_${id}`);
                const workspace = stored ? JSON.parse(stored) : { messages: [], files: null, createdAt: Date.now() };
                workspace.files = fileData;
                localStorage.setItem(`workspace_${id}`, JSON.stringify(workspace));
            } catch (error) {
                console.error('Error persisting files:', error);
            }
        }
    }, [id]);

    const GenerateAiCode = useCallback(async (currentMessages) => {
        if (isGeneratingRef.current) return;
        isGeneratingRef.current = true;
        setLoading(true);
        
        const PROMPT = JSON.stringify(currentMessages) + " " + Prompt.CODE_GEN_PROMPT;
        
        try {
            const response = await fetch('/api/gen-ai-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: PROMPT }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate code');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let finalData = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.done && data.final) {
                                finalData = data.final;
                            }
                            if (data.error) {
                                console.error('AI code gen error:', data.error);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            if (finalData && finalData.files) {
                const processedAiFiles = preprocessFiles(finalData.files);
                const mergedFiles = { ...Lookup.DEFAULT_FILE, ...processedAiFiles };
                setFiles(mergedFiles);
                // Persist to localStorage
                persistFiles(finalData.files);
            }
        } catch (error) {
            console.error('Error generating AI code:', error);
        } finally {
            setLoading(false);
            isGeneratingRef.current = false;
        }
    }, [preprocessFiles, persistFiles]);

    useEffect(() => {
        if (messages?.length > 0 && !isGeneratingRef.current) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'user') {
                GenerateAiCode(messages);
            }
        }
    }, [messages, GenerateAiCode]);
    
    const downloadFiles = useCallback(async () => {
        try {
            const zip = new JSZip();
            
            Object.entries(files).forEach(([filename, content]) => {
                let fileContent;
                if (typeof content === 'string') {
                    fileContent = content;
                } else if (content && typeof content === 'object') {
                    if (content.code) {
                        fileContent = content.code;
                    } else {
                        fileContent = JSON.stringify(content, null, 2);
                    }
                }

                if (fileContent) {
                    const cleanFileName = filename.startsWith('/') ? filename.slice(1) : filename;
                    zip.file(cleanFileName, fileContent);
                }
            });

            // Add package.json with dependencies
            const packageJson = {
                name: "generated-project",
                version: "1.0.0",
                private: true,
                dependencies: Lookup.DEPENDANCY,
                scripts: {
                    "dev": "vite",
                    "build": "vite build",
                    "preview": "vite preview"
                }
            };
            zip.file("package.json", JSON.stringify(packageJson, null, 2));

            const blob = await zip.generateAsync({ type: "blob" });
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-files.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading files:', error);
        }
    }, [files]);

    return (
        <div className='relative rounded-xl overflow-hidden border border-gray-800'>
            <div className='bg-[#181818] w-full p-2 border-b border-gray-800'>
                <div className='flex items-center justify-between'>
                    <div className='flex items-center flex-wrap shrink-0 bg-black p-1 justify-center
                    w-[140px] gap-3 rounded-full'>
                        <h2 onClick={() => setActiveTab('code')}
                            className={`text-sm cursor-pointer 
                        ${activeTab === 'code' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}>
                            Code</h2>

                        <h2 onClick={() => setActiveTab('preview')}
                            className={`text-sm cursor-pointer 
                        ${activeTab === 'preview' && 'text-blue-500 bg-blue-500 bg-opacity-25 p-1 px-2 rounded-full'}`}>
                            Preview</h2>
                    </div>
                    
                    <button
                        onClick={downloadFiles}
                        className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full transition-colors duration-200 text-sm"
                    >
                        <Download className="h-4 w-4" />
                        <span>Export</span>
                    </button>
                </div>
            </div>
            <SandpackProvider 
                files={files}
                template="react" 
                theme={'dark'}
                customSetup={{
                    dependencies: {
                        ...Lookup.DEPENDANCY
                    },
                    entry: '/index.js'
                }}
                options={{
                    externalResources: ['https://cdn.tailwindcss.com'],
                    bundlerTimeoutSecs: 120,
                    recompileMode: "immediate",
                    recompileDelay: 300
                }}
            >
                <div className="relative">
                    <SandpackLayout>
                        {activeTab === 'code' ? (
                            <>
                                <SandpackFileExplorer style={{ height: '80vh' }} />
                                <SandpackCodeEditor 
                                    style={{ height: '80vh' }}
                                    showTabs
                                    showLineNumbers
                                    showInlineErrors
                                    wrapContent 
                                />
                            </>
                        ) : (
                            <SandpackPreview 
                                style={{ height: '80vh' }} 
                                showNavigator={true}
                                showOpenInCodeSandbox={false}
                                showRefreshButton={true}
                            />
                        )}
                    </SandpackLayout>
                </div>
            </SandpackProvider>

            {loading && (
                <div className='p-10 bg-gray-900/90 absolute top-0 rounded-lg w-full h-full flex items-center justify-center z-20'>
                    <Loader2Icon className='animate-spin h-10 w-10 text-white mr-3'/>
                    <h2 className='text-white text-lg'>Generating your code...</h2>
                </div>
            )}
        </div>
    );
}

export default CodeView;
