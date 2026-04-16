/**
 * Tests for useThread composable
 *
 * Refs ainative-website#1104
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from 'vue';
import { AINativeConfigKey } from '../composables/useAINative';
import { useThread } from '../composables/useThread';
import type { Thread, ThreadMessage } from '../composables/useThread';

global.fetch = vi.fn();

const mockThread: Thread = {
  id: 'thread-1',
  title: 'Test Thread',
  agent_types: ['assistant'],
  model: null,
  status: 'active',
  message_count: 2,
  last_message_at: '2026-01-01T01:00:00Z',
  metadata: {},
  created_at: '2026-01-01T00:00:00Z',
};

const mockMessage: ThreadMessage = {
  id: 'msg-1',
  thread_id: 'thread-1',
  role: 'user',
  content: 'Hello',
  tool_calls: null,
  tokens_used: null,
  created_at: '2026-01-01T01:00:00Z',
};

function withApp<T>(fn: () => T): T {
  let result!: T;
  const app = createApp({ setup() { result = fn(); return {}; }, template: '<div/>' });
  app.provide(AINativeConfigKey, { apiKey: 'test-key', baseUrl: 'https://api.test.com' });
  const mountPoint = document.createElement('div');
  app.mount(mountPoint);
  return result;
}

describe('useThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Initial load ───────────────────────────────────────────────────

  it('should start with isLoading=true and load threads on mount', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockThread],
    });

    const { threads, isLoading, error } = withApp(() => useThread());
    expect(isLoading.value).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(isLoading.value).toBe(false);
    expect(threads.value).toHaveLength(1);
    expect(threads.value[0]).toEqual(mockThread);
    expect(error.value).toBeNull();
  });

  it('should set error when initial load fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ detail: 'DB error' }),
    });

    const { error, isLoading } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(isLoading.value).toBe(false);
    expect(error.value).toMatchObject({ message: 'DB error', status: 500 });
  });

  // ─── create ─────────────────────────────────────────────────────────

  it('should create a thread and prepend to list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockThread });

    const { threads, create } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const thread = await create('Test Thread', ['assistant']);
    expect(thread).toEqual(mockThread);
    expect(threads.value).toHaveLength(1);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/threads'),
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
        json: async () => ({ detail: 'Invalid request' }),
      });

    const { error, create } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await create();
    expect(result).toBeNull();
    expect(error.value).toMatchObject({ message: 'Invalid request', status: 400 });
  });

  // ─── get ────────────────────────────────────────────────────────────

  it('should get a thread with messages', async () => {
    const withMessages = { ...mockThread, messages: [mockMessage] };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => withMessages });

    const { get } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const thread = await get('thread-1');
    expect(thread).toEqual(withMessages);
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/threads/thread-1'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  // ─── appendMessage ──────────────────────────────────────────────────

  it('should append a message and update message_count', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockMessage });

    const { threads, appendMessage } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const msg = await appendMessage('thread-1', { role: 'user', content: 'Hello' });
    expect(msg).toEqual(mockMessage);
    expect(threads.value[0].message_count).toBe(3);
  });

  it('should set error and return null when appendMessage fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Thread not found' }),
      });

    const { error, appendMessage } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await appendMessage('bad-id', { role: 'user', content: 'Hi' });
    expect(result).toBeNull();
    expect(error.value).toMatchObject({ message: 'Thread not found', status: 404 });
  });

  // ─── search ─────────────────────────────────────────────────────────

  it('should search threads and return results', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] });

    const { search } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const results = await search('dark mode', 'keyword');
    expect(results).toHaveLength(1);

    const url: string = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(url).toContain('mode=keyword');
  });

  it('should set error and return empty array when search fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockRejectedValueOnce(new Error('Search failed'));

    const { error, search } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const results = await search('query');
    expect(results).toEqual([]);
    expect(error.value).toMatchObject({ message: 'Search failed' });
  });

  // ─── fork ───────────────────────────────────────────────────────────

  it('should fork a thread and prepend to list', async () => {
    const forked = { ...mockThread, id: 'thread-fork', title: 'Forked' };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => forked });

    const { threads, fork } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const thread = await fork('thread-1', 'msg-1', 'Forked');
    expect(thread).toEqual(forked);
    expect(threads.value).toHaveLength(2);
    expect(threads.value[0].id).toBe('thread-fork');
  });

  // ─── remove ─────────────────────────────────────────────────────────

  it('should remove a thread and update list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const { threads, remove } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const success = await remove('thread-1');
    expect(success).toBe(true);
    expect(threads.value).toHaveLength(0);
  });

  it('should set error and return false when remove fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Thread not found' }),
      });

    const { error, remove, threads } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));

    const success = await remove('bad-id');
    expect(success).toBe(false);
    expect(threads.value).toHaveLength(1);
    expect(error.value).toMatchObject({ message: 'Thread not found', status: 404 });
  });

  // ─── refetch ────────────────────────────────────────────────────────

  it('should refetch thread list', async () => {
    const updated = { ...mockThread, title: 'Updated' };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [updated] });

    const { threads, refetch } = withApp(() => useThread());
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(threads.value[0].title).toBe('Test Thread');

    await refetch();
    expect(threads.value[0].title).toBe('Updated');
  });
});
