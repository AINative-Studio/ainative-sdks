/**
 * Example: Next.js App Router - Client Component
 *
 * Demonstrates using the Next.js SDK in a Client Component
 * with React hooks for chat functionality.
 */

'use client';

import { AINativeProvider, useChat } from '@ainative/next-sdk/client';
import { useState } from 'react';

function ChatInterface() {
  const [input, setInput] = useState('');
  const { messages, isLoading, error, sendMessage } = useChat();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    await sendMessage(input);
    setInput('');
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
        {isLoading && <div className="loading">Thinking...</div>}
        {error && <div className="error">Error: {error.message}</div>}
      </div>

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default function ChatPage({ apiKey }: { apiKey: string }) {
  return (
    <AINativeProvider config={{ apiKey }}>
      <div className="page">
        <h1>Chat</h1>
        <ChatInterface />
      </div>
    </AINativeProvider>
  );
}
