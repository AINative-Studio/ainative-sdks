/**
 * Tests for useChat hook
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { AINativeProvider } from '../AINativeProvider';
import { useChat } from '../hooks/useChat';
import { Message } from '../types';

// Mock fetch
global.fetch = jest.fn();

describe('useChat', () => {
  const mockConfig = {
    apiKey: 'test-api-key',
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AINativeProvider config={mockConfig}>{children}</AINativeProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useChat(), { wrapper });

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.response).toBeNull();
  });

  it('should send message successfully', async () => {
    const mockResponse = {
      id: 'chatcmpl-123',
      model: 'llama-3.3-70b-instruct',
      provider: 'meta',
      created: 1704592800,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18,
      },
      credits_consumed: 0.52,
      credits_remaining: 999.48,
      plan_tier: 'basic',
      finish_reason: 'stop',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useChat(), { wrapper });

    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
    ];

    await result.current.sendMessage(messages);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toEqual(messages[0]);
    expect(result.current.messages[1]).toEqual(mockResponse.choices[0].message);
    expect(result.current.response).toEqual(mockResponse);
    expect(result.current.error).toBeNull();
  });

  it('should handle API errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 402,
      statusText: 'Payment Required',
      json: async () => ({
        detail: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
      }),
    });

    const { result } = renderHook(() => useChat(), { wrapper });

    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
    ];

    await result.current.sendMessage(messages);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual({
      message: 'Insufficient credits',
      status: 402,
      code: 'INSUFFICIENT_CREDITS',
    });
    expect(result.current.response).toBeNull();
  });

  it('should handle network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() => useChat(), { wrapper });

    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
    ];

    await result.current.sendMessage(messages);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual({
      message: 'Network error',
    });
  });

  it('should reset state', () => {
    const { result } = renderHook(() => useChat(), { wrapper });

    // Manually set some state
    result.current.sendMessage([{ role: 'user', content: 'Test' }]);

    // Reset
    result.current.reset();

    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.response).toBeNull();
  });

  it('should call onSuccess callback', async () => {
    const mockResponse = {
      id: 'chatcmpl-123',
      model: 'llama-3.3-70b-instruct',
      provider: 'meta',
      created: 1704592800,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Success!',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
      credits_consumed: 0.51,
      credits_remaining: 999.49,
      plan_tier: 'basic',
      finish_reason: 'stop',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const onSuccess = jest.fn();
    const { result } = renderHook(() => useChat({ onSuccess }), { wrapper });

    await result.current.sendMessage([{ role: 'user', content: 'Test' }]);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockResponse);
    });
  });

  it('should call onError callback', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        detail: 'Rate limit exceeded',
      }),
    });

    const onError = jest.fn();
    const { result } = renderHook(() => useChat({ onError }), { wrapper });

    await result.current.sendMessage([{ role: 'user', content: 'Test' }]);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith({
        message: 'Rate limit exceeded',
        status: 429,
        code: undefined,
      });
    });
  });
});
