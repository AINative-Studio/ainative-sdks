/**
 * Tests for createServerClient utility
 */

import { createServerClient } from '../server/createServerClient';
import type { ChatCompletionResponse, CreditBalance } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('createServerClient', () => {
  const mockApiKey = 'test-api-key';
  const baseUrl = 'https://api.test.com/api/v1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('chat.completions.create', () => {
    it('should make POST request to chat completions endpoint', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chat-123',
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        created: 1234567890,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        credits_consumed: 0.01,
        credits_remaining: 99.99,
        plan_tier: 'pro',
        finish_reason: 'stop',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = createServerClient({ apiKey: mockApiKey, baseUrl });
      const result = await client.chat.completions.create({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/public/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Hello' }],
          }),
        }
      );

      expect(result).toEqual(mockResponse);
    });

    it('should use default base URL when not provided', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chat-123',
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        created: 1234567890,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        credits_consumed: 0.01,
        credits_remaining: 99.99,
        plan_tier: 'pro',
        finish_reason: 'stop',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = createServerClient({ apiKey: mockApiKey });
      await client.chat.completions.create({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.ainative.studio/api/v1/public/chat/completions',
        expect.any(Object)
      );
    });

    it('should throw error on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid API key' }),
      });

      const client = createServerClient({ apiKey: mockApiKey, baseUrl });

      await expect(
        client.chat.completions.create({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('Invalid API key');
    });

    it('should handle JSON parse errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const client = createServerClient({ apiKey: mockApiKey, baseUrl });

      await expect(
        client.chat.completions.create({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });

  describe('credits.balance', () => {
    it('should make GET request to credits balance endpoint', async () => {
      const mockBalance: CreditBalance = {
        total_credits: 100,
        used_credits: 10,
        remaining_credits: 90,
        plan: 'pro',
        period_start: '2024-01-01T00:00:00Z',
        period_end: '2024-02-01T00:00:00Z',
        usage_percentage: 10,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockBalance,
      });

      const client = createServerClient({ apiKey: mockApiKey, baseUrl });
      const result = await client.credits.balance();

      expect(global.fetch).toHaveBeenCalledWith(
        `${baseUrl}/public/credits/balance`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
        }
      );

      expect(result).toEqual(mockBalance);
    });

    it('should throw error on failed request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'Access denied' }),
      });

      const client = createServerClient({ apiKey: mockApiKey, baseUrl });

      await expect(client.credits.balance()).rejects.toThrow('Access denied');
    });
  });
});
