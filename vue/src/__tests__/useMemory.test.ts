/**
 * Tests for useMemory composable
 *
 * Refs ainative-website#1104
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from 'vue';
import { AINativeConfigKey } from '../composables/useAINative';
import { useMemory } from '../composables/useMemory';
import type { Memory } from '../composables/useMemory';

global.fetch = vi.fn();

const mockMemory: Memory = {
  id: 'mem-1',
  content: 'User prefers dark mode',
  memory_type: 'preference',
  importance: 0.8,
  tags: ['preference', 'ui'],
  entity_id: 'user-123',
  metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};

function withApp<T>(fn: () => T): T {
  let result!: T;
  const app = createApp({ setup() { result = fn(); return {}; }, template: '<div/>' });
  app.provide(AINativeConfigKey, { apiKey: 'test-key', baseUrl: 'https://api.test.com' });
  const mountPoint = document.createElement('div');
  app.mount(mountPoint);
  return result;
}

describe('useMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Without entityId ────────────────────────────────────────────────

  it('should start with empty memories and isLoading=false when no entityId', () => {
    const { memories, isLoading, error } = withApp(() => useMemory());
    expect(memories.value).toEqual([]);
    expect(isLoading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('should not fetch on mount when no entityId', async () => {
    withApp(() => useMemory());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ─── With entityId ───────────────────────────────────────────────────

  it('should start with isLoading=true and fetch when entityId is provided', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockMemory],
    });

    const { memories, isLoading } = withApp(() => useMemory('user-123'));
    expect(isLoading.value).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(isLoading.value).toBe(false);
    expect(memories.value).toHaveLength(1);
    expect(memories.value[0]).toEqual(mockMemory);
  });

  it('should POST to /public/memory/v2/recall with entity_id on mount', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    withApp(() => useMemory('user-123'));
    await new Promise(resolve => setTimeout(resolve, 0));

    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.entity_id).toBe('user-123');
  });

  it('should set error when initial load fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ detail: 'DB error' }),
    });

    const { error } = withApp(() => useMemory('user-123'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(error.value).toMatchObject({ message: 'DB error', status: 500 });
  });

  // ─── remember ───────────────────────────────────────────────────────

  it('should remember a memory and prepend to list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockMemory,
    });

    const { memories, remember } = withApp(() => useMemory());
    const result = await remember('User prefers dark mode', { tags: ['preference'] });

    expect(result).toEqual(mockMemory);
    expect(memories.value).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/public/memory/v2/remember'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should scope remember to entityId from composable', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockMemory] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockMemory });

    const { remember } = withApp(() => useMemory('user-123'));
    await new Promise(resolve => setTimeout(resolve, 0));

    await remember('Another memory');

    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].body
    );
    expect(body.entity_id).toBe('user-123');
  });

  it('should set error and return null when remember fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ detail: 'Invalid content' }),
    });

    const { error, remember } = withApp(() => useMemory());
    const result = await remember('');

    expect(result).toBeNull();
    expect(error.value).toMatchObject({ message: 'Invalid content', status: 400 });
  });

  // ─── recall ─────────────────────────────────────────────────────────

  it('should recall memories and update state', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockMemory],
    });

    const { memories, recall } = withApp(() => useMemory());
    const results = await recall('dark mode');

    expect(results).toHaveLength(1);
    expect(memories.value).toHaveLength(1);
  });

  it('should set error and return empty array when recall fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Recall failed'));

    const { error, recall } = withApp(() => useMemory());
    const results = await recall('something');

    expect(results).toEqual([]);
    expect(error.value).toMatchObject({ message: 'Recall failed' });
  });

  // ─── forget ─────────────────────────────────────────────────────────

  it('should forget a memory and remove from list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockMemory] })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const { memories, forget } = withApp(() => useMemory('user-123'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(memories.value).toHaveLength(1);

    const success = await forget('mem-1');
    expect(success).toBe(true);
    expect(memories.value).toHaveLength(0);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/public/memory/v2/forget/mem-1'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('should set error and return false when forget fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ detail: 'Memory not found' }),
    });

    const { error, forget } = withApp(() => useMemory());
    const success = await forget('bad-id');

    expect(success).toBe(false);
    expect(error.value).toMatchObject({ message: 'Memory not found', status: 404 });
  });
});
