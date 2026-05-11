"use client";

import React, { useMemo } from 'react';
import { ConvexProvider, ConvexReactClient } from "convex/react";

const ConvexClientProvider = ({ children }) => {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    
    const client = useMemo(() => {
        if (!convexUrl) return null;
        return new ConvexReactClient(convexUrl);
    }, [convexUrl]);

    if (!client) {
        // If no Convex URL is configured, show a setup message
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center p-8 bg-gray-900 rounded-xl border border-gray-800 max-w-md">
                    <h2 className="text-xl font-bold text-white mb-4">Setup Required</h2>
                    <p className="text-gray-400 mb-4">
                        Please set your <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">NEXT_PUBLIC_CONVEX_URL</code> environment variable in <code className="bg-gray-800 px-2 py-1 rounded text-blue-400">.env.local</code> to connect to your Convex backend.
                    </p>
                    <p className="text-gray-500 text-sm">
                        Run <code className="bg-gray-800 px-1 rounded">npx convex dev</code> to get your URL.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ConvexProvider client={client}>
            {children}
        </ConvexProvider>
    );
};

export default ConvexClientProvider;
