/**
 * Tests for createThread store
 *
 * Refs ainative-website#1103
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { setAINativeConfig } from '../stores/config';
import { createThread } from '../stores/thread';
import type { Thread, ThreadMessage } from '../stores/thread';

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

describe('createThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAINativeConfig({ apiKey: 'test-key', baseUrl: 'https://api.test.com' });
  });

  // ─── Initial load ───────────────────────────────────────────────────

  it('should start with isLoading=true and fetch threads on init', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [mockThread],
    });

    const store = createThread();
    expect(get(store.isLoading)).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(get(store.isLoading)).toBe(false);
    expect(get(store.threads)).toHaveLength(1);
    expect(get(store.threads)[0]).toEqual(mockThread);
    expect(get(store.error)).toBeNull();
  });

  it('should set error when initial load fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({ detail: 'DB error' }),
    });

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(get(store.error)).toMatchObject({ message: 'DB error', status: 500 });
    expect(get(store.isLoading)).toBe(false);
  });

  it('should include Authorization header in requests', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );
  });

  // ─── create ─────────────────────────────────────────────────────────

  it('should create a thread and prepend to list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockThread });

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const thread = await store.create('Test Thread', ['assistant']);
    expect(thread).toEqual(mockThread);
    expect(get(store.threads)).toHaveLength(1);
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

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await store.create();
    expect(result).toBeNull();
    expect(get(store.error)).toMatchObject({ message: 'Invalid request', status: 400 });
  });

  // ─── get ────────────────────────────────────────────────────────────

  it('should get a thread with messages by id', async () => {
    const withMessages = { ...mockThread, messages: [mockMessage] };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => withMessages });

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const thread = await store.get('thread-1');
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

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const msg = await store.appendMessage('thread-1', { role: 'user', content: 'Hello' });
    expect(msg).toEqual(mockMessage);
    expect(get(store.threads)[0].message_count).toBe(3); // 2 + 1
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/threads/thread-1/messages'),
      expect.objectContaining({ method: 'POST' })
    );
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

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await store.appendMessage('bad-id', { role: 'user', content: 'Hi' });
    expect(result).toBeNull();
    expect(get(store.error)).toMatchObject({ message: 'Thread not found', status: 404 });
  });

  // ─── search ─────────────────────────────────────────────────────────

  it('should search threads and return results', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] });

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const results = await store.search('dark mode');
    expect(results).toHaveLength(1);

    const url: string = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(url).toContain('search=dark+mode');
    expect(url).toContain('mode=semantic');
  });

  it('should set error and return empty array when search fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockRejectedValueOnce(new Error('Search failed'));

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const results = await store.search('query');
    expect(results).toEqual([]);
    expect(get(store.error)).toMatchObject({ message: 'Search failed' });
  });

  // ─── fork ───────────────────────────────────────────────────────────

  it('should fork a thread and prepend to list', async () => {
    const forked = { ...mockThread, id: 'thread-fork', title: 'Forked' };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => forked });

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const thread = await store.fork('thread-1', 'msg-1', 'Forked');
    expect(thread).toEqual(forked);
    expect(get(store.threads)).toHaveLength(2);
    expect(get(store.threads)[0].id).toBe('thread-fork');
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/threads/thread-1/fork'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  // ─── remove ─────────────────────────────────────────────────────────

  it('should remove a thread and update list', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const success = await store.remove('thread-1');
    expect(success).toBe(true);
    expect(get(store.threads)).toHaveLength(0);
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

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    const success = await store.remove('bad-id');
    expect(success).toBe(false);
    expect(get(store.threads)).toHaveLength(1);
    expect(get(store.error)).toMatchObject({ message: 'Thread not found', status: 404 });
  });

  // ─── refetch ────────────────────────────────────────────────────────

  it('should refetch thread list', async () => {
    const updated = { ...mockThread, title: 'Updated' };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [mockThread] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [updated] });

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(get(store.threads)[0].title).toBe('Test Thread');

    await store.refetch();
    expect(get(store.threads)[0].title).toBe('Updated');
  });

  // ─── list with params ────────────────────────────────────────────────

  it('should pass query params when calling list()', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });

    const store = createThread();
    await new Promise(resolve => setTimeout(resolve, 0));

    await store.list({ limit: 5, status: 'active', search: 'hello' });

    const url: string = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(url).toContain('limit=5');
    expect(url).toContain('status=active');
    expect(url).toContain('search=hello');
  });
});
