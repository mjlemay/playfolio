// 'use client';

// import { api } from '@/lib/trpc/react';
// import { useState } from 'react';

export default function TRPCDemo() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">
          🚀 tRPC Demo - Temporarily Disabled
        </h1>
        
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">⚠️ Module Resolution Issue</h2>
          <p className="text-gray-300 mb-4">
            The tRPC demo is temporarily disabled due to a module resolution issue with @tanstack/react-query.
          </p>
          
          <h3 className="text-xl font-semibold mb-3">🔧 To Fix This Issue:</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Free up disk space (your disk is 99% full)</li>
            <li>Run: <code className="bg-gray-700 px-2 py-1 rounded">sudo rm -rf node_modules</code></li>
            <li>Run: <code className="bg-gray-700 px-2 py-1 rounded">npm install</code></li>
            <li>Uncomment the TRPCProvider in layout.tsx</li>
            <li>Restore this demo page</li>
          </ol>
          
          <div className="mt-6 p-4 bg-blue-900 border border-blue-700 rounded">
            <h4 className="font-semibold text-blue-200">Alternative:</h4>
            <p className="text-blue-300">
              Use the REST API endpoints documented on the main page, which are fully functional.
            </p>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <a href="/" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            ← Back to REST API Documentation
          </a>
        </div>
      </div>
    </div>
  );
}