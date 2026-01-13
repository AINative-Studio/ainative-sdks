/**
 * Basic Example: Using AINative React SDK
 *
 * This example demonstrates how to use the @ainative/react-sdk
 * to build a simple chat interface with credit tracking.
 */

import React, { useState } from 'react';
import {
  AINativeProvider,
  useChat,
  useCredits,
  Message,
} from '@ainative/react-sdk';

// Main App Component
function App() {
  // Replace with your JWT token from authentication
  const apiKey = 'your-jwt-token-here';

  return (
    <AINativeProvider config={{ apiKey }}>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>AINative Chat Demo</h1>
        <CreditsDisplay />
        <ChatInterface />
      </div>
    </AINativeProvider>
  );
}

// Credits Display Component
function CreditsDisplay() {
  const { balance, isLoading, error, refetch } = useCredits();

  if (isLoading) return <div>Loading credits...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error.message}</div>;

  return (
    <div
      style={{
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '20px',
      }}
    >
      <h3>Credits Overview</h3>
      <p>
        <strong>Remaining:</strong> {balance?.remaining_credits} /{' '}
        {balance?.total_credits}
      </p>
      <p>
        <strong>Plan:</strong> {balance?.plan}
      </p>
      <p>
        <strong>Usage:</strong> {balance?.usage_percentage}%
      </p>
      <button onClick={refetch}>Refresh Balance</button>
    </div>
  );
}

// Chat Interface Component
function ChatInterface() {
  const [input, setInput] = useState('');
  const { messages, isLoading, error, sendMessage, reset } = useChat({
    model: 'llama-3.3-70b-instruct',
    temperature: 0.7,
    max_tokens: 1000,
    onSuccess: (response) => {
      console.log('Credits consumed:', response.credits_consumed);
      console.log('Credits remaining:', response.credits_remaining);
    },
    onError: (error) => {
      if (error.status === 402) {
        alert('Insufficient credits! Please purchase more credits.');
      } else if (error.status === 403) {
        alert('This model is not available for your plan.');
      } else if (error.status === 429) {
        alert('Rate limit exceeded. Please try again later.');
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    };

    setInput('');
    await sendMessage([...messages, userMessage]);
  };

  return (
    <div>
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '15px',
          height: '400px',
          overflowY: 'auto',
          marginBottom: '15px',
          backgroundColor: '#fff',
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center', marginTop: '50px' }}>
            Start a conversation...
          </p>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              marginBottom: '15px',
              padding: '10px',
              borderRadius: '6px',
              backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                marginBottom: '5px',
                color: msg.role === 'user' ? '#1976d2' : '#666',
              }}
            >
              {msg.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
          </div>
        ))}

        {isLoading && (
          <div style={{ textAlign: 'center', color: '#999' }}>
            Thinking...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '10px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '6px',
              marginTop: '10px',
            }}
          >
            Error: {error.message}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '10px 20px',
              backgroundColor: '#757575',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Clear
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
