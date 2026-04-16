/**
 * Tests for useAgent hook
 *
 * Refs ainative-website#1102
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AINativeProvider } from '../AINativeProvider';
import { useAgent } from '../hooks/useAgent';
import type { AgentRegistration } from '../hooks/useAgent';

// Mock fetch
global.fetch = jest.fn();

const mockAgent: AgentRegistration = {
  id: 'agent-1',
  name: 'Test Agent',
  agent_type: 'assistant',
  capabilities: ['chat'],
  oversight_level: 'standard',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
};

describe('useAgent', () => {
  const mockConfig = { apiKey: 'test-api-key' };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AINativeProvider config={mockConfig}>{children}</AINativeProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Initial load ───────────────────────────────────────────────────

  it('should fetch agents on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockAgent],
    });

    const { result } = renderHook(() => useAgent(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.agents).toHaveLength(1);
    expect(result.current.agents[0]).toEqual(mockAgent);
    expect(result.current.error).toBeNull();
  });

  it('should use correct list endpoint with auth header', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    renderHook(() => useAgent(), { wrapper });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.ainative.studio/api/v1/auth/agents',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });
  });

  it('should handle fetch error on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ detail: 'Invalid API key' }),
    });

    const { result } = renderHook(() => useAgent(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.agents).toHaveLength(0);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Invalid API key', status: 401 })
    );
  });

  it('should handle network error on mount', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAgent(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Network error' })
    );
  });

  // ─── create ─────────────────────────────────────────────────────────

  it('should create an agent and append to list', async () => {
    // Initial load returns empty
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // create call
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAgent,
    });

    let created: AgentRegistration | null = null;
    await act(async () => {
      created = await result.current.create({
        name: 'Test Agent',
        agent_type: 'assistant',
        capabilities: ['chat'],
      });
    });

    expect(created).toEqual(mockAgent);
    expect(result.current.agents).toHaveLength(1);
    expect(result.current.agents[0]).toEqual(mockAgent);
  });

  it('should post to register endpoint when creating', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockAgent });

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.create({
        name: 'Test Agent',
        agent_type: 'assistant',
        capabilities: ['chat'],
      });
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      'https://api.ainative.studio/api/v1/auth/agents/register',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should set error when create fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ detail: 'Invalid config' }),
      });

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: AgentRegistration | null = undefined as unknown as null;
    await act(async () => {
      created = await result.current.create({
        name: 'Bad',
        agent_type: 'unknown',
        capabilities: [],
      });
    });

    expect(created).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Invalid config', status: 400 })
    );
  });

  // ─── get ────────────────────────────────────────────────────────────

  it('should get a single agent by id', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockAgent });

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let agent: AgentRegistration | null = null;
    await act(async () => {
      agent = await result.current.get('agent-1');
    });

    expect(agent).toEqual(mockAgent);
    expect(global.fetch).toHaveBeenLastCalledWith(
      'https://api.ainative.studio/api/v1/auth/agents/agent-1',
      expect.objectContaining({ method: 'GET' })
    );
  });

  // ─── remove ─────────────────────────────────────────────────────────

  it('should remove an agent and update list', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockAgent] })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.agents).toHaveLength(1));

    let success = false;
    await act(async () => {
      success = await result.current.remove('agent-1');
    });

    expect(success).toBe(true);
    expect(result.current.agents).toHaveLength(0);
  });

  it('should set error when remove fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockAgent] })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Agent not found' }),
      });

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.agents).toHaveLength(1));

    let success = true;
    await act(async () => {
      success = await result.current.remove('bad-id');
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Agent not found', status: 404 })
    );
    expect(result.current.agents).toHaveLength(1);
  });

  // ─── refetch ────────────────────────────────────────────────────────

  it('should refetch agent list', async () => {
    const agentV2 = { ...mockAgent, name: 'Updated Agent' };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockAgent] })
      .mockResolvedValueOnce({ ok: true, json: async () => [agentV2] });

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.agents[0].name).toBe('Test Agent'));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.agents[0].name).toBe('Updated Agent'));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ─── branch coverage: get error path ───────────────────────────────

  it('should set error and return null when get fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Agent not found' }),
      });

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let agent: AgentRegistration | null = undefined as unknown as null;
    await act(async () => {
      agent = await result.current.get('bad-id');
    });

    expect(agent).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Agent not found', status: 404 })
    );
  });

  it('should return agents array from list()', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })   // mount
      .mockResolvedValueOnce({ ok: true, json: async () => [mockAgent] }); // list call

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let listed: AgentRegistration[] = [];
    await act(async () => {
      listed = await result.current.list();
    });

    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(mockAgent);
  });

  it('should use fallback error message when response body lacks detail', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}), // no detail field
    });

    const { result } = renderHook(() => useAgent(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.message).toBe('HTTP 500: Internal Server Error');
  });

  it('should handle 204 No Content response on remove', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockAgent] })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => { throw new Error('no body'); },
      });

    const { result } = renderHook(() => useAgent(), { wrapper });
    await waitFor(() => expect(result.current.agents).toHaveLength(1));

    let success = false;
    await act(async () => {
      success = await result.current.remove('agent-1');
    });

    expect(success).toBe(true);
  });
});
