/**
 * Tests for createAgent store
 *
 * Refs ainative-website#1103
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { setAINativeConfig } from '../stores/config';
import { createAgent } from '../stores/agent';
import type { AgentRegistration } from '../stores/agent';

// Mock fetch globally
global.fetch = vi.fn();

const mockAgent: AgentRegistration = {
  id: 'agent-1',
  name: 'Test Agent',
  agent_type: 'assistant',
  capabilities: ['chat'],
  oversight_level: 'standard',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
};

function mockFetchOk(data: unknown, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    status,
    json: async () => data,
  });
}

function mockFetchError(status: number, detail: string) {
  return vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({ detail }),
  });
}

describe('createAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAINativeConfig({ apiKey: 'test-key', baseUrl: 'https://api.test.com' });
  });

  // ─── Initial load ───────────────────────────────────────────────────

  it('should start with isLoading=true and fetch agents on init', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockAgent],
    });

    const store = createAgent();

    // Immediately after creation isLoading should be true
    expect(get(store.isLoading)).toBe(true);

    // Wait for the initial fetch to settle
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(get(store.isLoading)).toBe(false);
    expect(get(store.agents)).toHaveLength(1);
    expect(get(store.agents)[0]).toEqual(mockAgent);
    expect(get(store.error)).toBeNull();
  });

  it('should set error when initial load fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ detail: 'Invalid API key' }),
    });

    const store = createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(get(store.isLoading)).toBe(false);
    expect(get(store.agents)).toHaveLength(0);
    expect(get(store.error)).toMatchObject({ message: 'Invalid API key', status: 401 });
  });

  it('should include Authorization header in requests', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/agents'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  // ─── create ─────────────────────────────────────────────────────────

  it('should create an agent and append to list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockAgent });

    const store = createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));

    const created = await store.create({
      name: 'Test Agent',
      agent_type: 'assistant',
      capabilities: ['chat'],
    });

    expect(created).toEqual(mockAgent);
    expect(get(store.agents)).toHaveLength(1);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/auth/agents/register'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should set error and return null when create fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ detail: 'Invalid config' }),
      });

    const store = createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await store.create({ name: 'Bad', agent_type: 'x', capabilities: [] });

    expect(result).toBeNull();
    expect(get(store.error)).toMatchObject({ message: 'Invalid config', status: 400 });
  });

  // ─── get ────────────────────────────────────────────────────────────

  it('should get a single agent by id', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockAgent });

    const store = createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));

    const agent = await store.get('agent-1');
    expect(agent).toEqual(mockAgent);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/auth/agents/agent-1'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should set error and return null when get fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Agent not found' }),
      });

    const store = createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await store.get('bad-id');
    expect(result).toBeNull();
    expect(get(store.error)).toMatchObject({ message: 'Agent not found', status: 404 });
  });

  // ─── remove ─────────────────────────────────────────────────────────

  it('should remove an agent and update list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockAgent] })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const store = createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(get(store.agents)).toHaveLength(1);

    const success = await store.remove('agent-1');
    expect(success).toBe(true);
    expect(get(store.agents)).toHaveLength(0);
  });

  it('should set error and return false when remove fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockAgent] })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Agent not found' }),
      });

    const store = createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));

    const success = await store.remove('bad-id');
    expect(success).toBe(false);
    expect(get(store.agents)).toHaveLength(1);
    expect(get(store.error)).toMatchObject({ message: 'Agent not found', status: 404 });
  });

  // ─── refetch ────────────────────────────────────────────────────────

  it('should refetch agent list', async () => {
    const agentV2 = { ...mockAgent, name: 'Updated Agent' };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockAgent] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [agentV2] });

    const store = createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(get(store.agents)[0].name).toBe('Test Agent');

    await store.refetch();
    expect(get(store.agents)[0].name).toBe('Updated Agent');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ─── options override ────────────────────────────────────────────────

  it('should use options.baseUrl and options.apiKey when provided', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    createAgent({ baseUrl: 'https://custom.api', apiKey: 'custom-key' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://custom.api'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer custom-key',
        }),
      })
    );
  });

  // ─── list ───────────────────────────────────────────────────────────

  it('should return agents array from list()', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockAgent] });

    const store = createAgent();
    await new Promise(resolve => setTimeout(resolve, 0));

    const listed = await store.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(mockAgent);
  });
});
