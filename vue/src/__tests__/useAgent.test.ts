/**
 * Tests for useAgent composable
 *
 * Refs ainative-website#1104
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from 'vue';
import { AINativeConfigKey } from '../composables/useAINative';
import { useAgent } from '../composables/useAgent';
import type { AgentRegistration } from '../composables/useAgent';

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

/**
 * Run a composable in a fake Vue app context with config provided.
 */
function withApp<T>(fn: () => T): T {
  let result!: T;
  const app = createApp({ setup() { result = fn(); return {}; }, template: '<div/>' });
  app.provide(AINativeConfigKey, { apiKey: 'test-key', baseUrl: 'https://api.test.com' });
  const mountPoint = document.createElement('div');
  app.mount(mountPoint);
  return result;
}

describe('useAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── mount ──────────────────────────────────────────────────────────

  it('should start with isLoading=true and load agents on mount', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockAgent],
    });

    const { agents, isLoading, error } = withApp(() => useAgent());

    expect(isLoading.value).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(isLoading.value).toBe(false);
    expect(agents.value).toHaveLength(1);
    expect(agents.value[0]).toEqual(mockAgent);
    expect(error.value).toBeNull();
  });

  it('should use Bearer Authorization header', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    withApp(() => useAgent());
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/auth/agents'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
  });

  it('should set error when initial load fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ detail: 'Invalid API key' }),
    });

    const { error, isLoading } = withApp(() => useAgent());
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(isLoading.value).toBe(false);
    expect(error.value).toMatchObject({ message: 'Invalid API key', status: 401 });
  });

  // ─── create ─────────────────────────────────────────────────────────

  it('should create an agent and append to list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockAgent });

    const { agents, create } = withApp(() => useAgent());
    await new Promise(resolve => setTimeout(resolve, 0));

    const created = await create({ name: 'Test Agent', agent_type: 'assistant', capabilities: ['chat'] });
    expect(created).toEqual(mockAgent);
    expect(agents.value).toHaveLength(1);
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

    const { error, create } = withApp(() => useAgent());
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await create({ name: 'Bad', agent_type: 'x', capabilities: [] });
    expect(result).toBeNull();
    expect(error.value).toMatchObject({ message: 'Invalid config', status: 400 });
  });

  // ─── get ────────────────────────────────────────────────────────────

  it('should get a single agent by id', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockAgent });

    const { get } = withApp(() => useAgent());
    await new Promise(resolve => setTimeout(resolve, 0));

    const agent = await get('agent-1');
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

    const { error, get } = withApp(() => useAgent());
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await get('bad-id');
    expect(result).toBeNull();
    expect(error.value).toMatchObject({ message: 'Agent not found', status: 404 });
  });

  // ─── remove ─────────────────────────────────────────────────────────

  it('should remove an agent and update list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockAgent] })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const { agents, remove } = withApp(() => useAgent());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(agents.value).toHaveLength(1);

    const success = await remove('agent-1');
    expect(success).toBe(true);
    expect(agents.value).toHaveLength(0);
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

    const { error, remove, agents } = withApp(() => useAgent());
    await new Promise(resolve => setTimeout(resolve, 0));

    const success = await remove('bad-id');
    expect(success).toBe(false);
    expect(agents.value).toHaveLength(1);
    expect(error.value).toMatchObject({ message: 'Agent not found', status: 404 });
  });

  // ─── refetch ────────────────────────────────────────────────────────

  it('should refetch agent list', async () => {
    const agentV2 = { ...mockAgent, name: 'Updated Agent' };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockAgent] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [agentV2] });

    const { agents, refetch } = withApp(() => useAgent());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(agents.value[0].name).toBe('Test Agent');

    await refetch();
    expect(agents.value[0].name).toBe('Updated Agent');
  });

  // ─── options override ────────────────────────────────────────────────

  it('should use options.baseUrl and options.apiKey when provided', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    withApp(() => useAgent({ baseUrl: 'https://custom.api', apiKey: 'custom-key' }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://custom.api'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer custom-key' }),
      })
    );
  });
});
