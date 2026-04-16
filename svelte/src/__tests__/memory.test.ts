/**
 * Tests for createMemory store
 *
 * Refs ainative-website#1103
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { setAINativeConfig } from '../stores/config';
import { createMemory } from '../stores/memory';
import type { Memory } from '../stores/memory';

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

describe('createMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAINativeConfig({ apiKey: 'test-key', baseUrl: 'https://api.test.com' });
  });

  // ─── Without entityId ────────────────────────────────────────────────

  it('should start with empty memories and isLoading=false when no entityId', () => {
    const store = createMemory();
    expect(get(store.memories)).toEqual([]);
    expect(get(store.isLoading)).toBe(false);
    expect(get(store.error)).toBeNull();
  });

  it('should not trigger a fetch on init when no entityId', async () => {
    createMemory();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // ─── With entityId ───────────────────────────────────────────────────

  it('should start with isLoading=true and fetch memories when entityId is provided', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockMemory],
    });

    const store = createMemory({ entityId: 'user-123' });
    expect(get(store.isLoading)).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(get(store.isLoading)).toBe(false);
    expect(get(store.memories)).toHaveLength(1);
    expect(get(store.memories)[0]).toEqual(mockMemory);
  });

  it('should POST to /public/memory/v2/recall with entity_id on init', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    createMemory({ entityId: 'user-123' });
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

    const store = createMemory({ entityId: 'user-123' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(get(store.error)).toMatchObject({ message: 'DB error', status: 500 });
    expect(get(store.isLoading)).toBe(false);
  });

  // ─── remember ───────────────────────────────────────────────────────

  it('should remember a memory and prepend to list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockMemory,
    });

    const store = createMemory();
    const result = await store.remember('User prefers dark mode', {
      tags: ['preference', 'ui'],
      entity_id: 'user-123',
    });

    expect(result).toEqual(mockMemory);
    expect(get(store.memories)).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/public/memory/v2/remember'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should scope remember to entityId when provided in options', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockMemory],
    });

    const store = createMemory({ entityId: 'user-123' });
    await new Promise(resolve => setTimeout(resolve, 0));

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockMemory,
    });

    await store.remember('Another memory');

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

    const store = createMemory();
    const result = await store.remember('');

    expect(result).toBeNull();
    expect(get(store.error)).toMatchObject({ message: 'Invalid content', status: 400 });
  });

  // ─── recall ─────────────────────────────────────────────────────────

  it('should recall memories and update store', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockMemory],
    });

    const store = createMemory();
    const results = await store.recall('dark mode');

    expect(results).toHaveLength(1);
    expect(get(store.memories)).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/public/memory/v2/recall'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should set error and return empty array when recall fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Recall failed'));

    const store = createMemory();
    const results = await store.recall('something');

    expect(results).toEqual([]);
    expect(get(store.error)).toMatchObject({ message: 'Recall failed' });
  });

  // ─── forget ─────────────────────────────────────────────────────────

  it('should forget a memory and remove from list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockMemory] })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const store = createMemory({ entityId: 'user-123' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(get(store.memories)).toHaveLength(1);

    const success = await store.forget('mem-1');
    expect(success).toBe(true);
    expect(get(store.memories)).toHaveLength(0);
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

    const store = createMemory();
    const success = await store.forget('bad-id');

    expect(success).toBe(false);
    expect(get(store.error)).toMatchObject({ message: 'Memory not found', status: 404 });
  });
});
