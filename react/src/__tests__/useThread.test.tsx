/**
 * Tests for useThread hook
 *
 * Refs ainative-website#1102
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AINativeProvider } from '../AINativeProvider';
import { useThread } from '../hooks/useThread';
import type { Thread, ThreadMessage, ThreadWithMessages } from '../hooks/useThread';

// Mock fetch
global.fetch = jest.fn();

const mockThread = (overrides: Partial<Thread> = {}): Thread => ({
  id: 'thread-1',
  title: 'Sales analysis',
  agent_types: ['analyst'],
  model: null,
  status: 'active',
  message_count: 2,
  last_message_at: '2026-01-01T01:00:00Z',
  metadata: {},
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const mockMessage = (overrides: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: 'msg-1',
  thread_id: 'thread-1',
  role: 'user',
  content: 'Hello agent',
  tool_calls: null,
  tokens_used: 10,
  created_at: '2026-01-01T01:00:00Z',
  ...overrides,
});

describe('useThread', () => {
  const mockConfig = { apiKey: 'test-api-key' };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AINativeProvider config={mockConfig}>{children}</AINativeProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Initial load ───────────────────────────────────────────────────

  it('should fetch threads on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockThread()],
    });

    const { result } = renderHook(() => useThread(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.threads).toHaveLength(1);
    expect(result.current.threads[0]).toEqual(mockThread());
    expect(result.current.error).toBeNull();
  });

  it('should use correct list endpoint with auth header', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    renderHook(() => useThread(), { wrapper });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/threads'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      })
    );
  });

  it('should handle fetch error on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ detail: 'Invalid API key' }),
    });

    const { result } = renderHook(() => useThread(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.threads).toHaveLength(0);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Invalid API key', status: 401 })
    );
  });

  it('should handle network error on mount', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useThread(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Network error' })
    );
  });

  // ─── create ─────────────────────────────────────────────────────────

  it('should create a thread and prepend to list', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })            // mount
      .mockResolvedValueOnce({ ok: true, json: async () => mockThread() }); // create

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let thread: Thread | null = null;
    await act(async () => {
      thread = await result.current.create('Sales analysis', ['analyst']);
    });

    expect(thread).toEqual(mockThread());
    expect(result.current.threads).toHaveLength(1);
  });

  it('should post to /threads endpoint when creating', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockThread() });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.create('My Thread');
    });

    const createCall = (global.fetch as jest.Mock).mock.calls[1];
    expect(createCall[0]).toContain('/threads');
    expect(createCall[1].method).toBe('POST');

    const body = JSON.parse(createCall[1].body);
    expect(body.title).toBe('My Thread');
  });

  it('should set error when create fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Server error' }),
      });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let thread: Thread | null = undefined as unknown as null;
    await act(async () => {
      thread = await result.current.create('Broken Thread');
    });

    expect(thread).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Server error', status: 500 })
    );
  });

  // ─── get ────────────────────────────────────────────────────────────

  it('should get a single thread with messages', async () => {
    const threadWithMsgs: ThreadWithMessages = {
      ...mockThread(),
      messages: [mockMessage()],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => threadWithMsgs });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let retrieved: ThreadWithMessages | null = null;
    await act(async () => {
      retrieved = await result.current.get('thread-1');
    });

    expect(retrieved).not.toBeNull();
    expect(retrieved!.messages).toHaveLength(1);
    expect(retrieved!.messages[0]).toEqual(mockMessage());
  });

  it('should call correct get endpoint', async () => {
    const threadWithMsgs: ThreadWithMessages = { ...mockThread(), messages: [] };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => threadWithMsgs });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.get('thread-1');
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/threads/thread-1'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  // ─── appendMessage ──────────────────────────────────────────────────

  it('should append a message and update thread message count', async () => {
    const thread = mockThread({ message_count: 0, last_message_at: null });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [thread] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockMessage() });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    let msg: ThreadMessage | null = null;
    await act(async () => {
      msg = await result.current.appendMessage('thread-1', {
        role: 'user',
        content: 'Hello agent',
      });
    });

    expect(msg).toEqual(mockMessage());
    expect(result.current.threads[0].message_count).toBe(1);
  });

  it('should post to messages endpoint', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockThread()] })
      .mockResolvedValueOnce({ ok: true, json: async () => mockMessage() });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    await act(async () => {
      await result.current.appendMessage('thread-1', { role: 'user', content: 'Hi' });
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/threads/thread-1/messages'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  // ─── search ─────────────────────────────────────────────────────────

  it('should search threads with query and mode', async () => {
    const searchResults = [mockThread({ title: 'Sales Q1' })];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })       // mount
      .mockResolvedValueOnce({ ok: true, json: async () => searchResults }); // search

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let found: Thread[] = [];
    await act(async () => {
      found = await result.current.search('sales', 'semantic');
    });

    expect(found).toHaveLength(1);
    expect(found[0].title).toBe('Sales Q1');
  });

  it('should pass search and mode as query params', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.search('analysis', 'hybrid');
    });

    const url: string = (global.fetch as jest.Mock).mock.calls[1][0];
    expect(url).toContain('search=analysis');
    expect(url).toContain('mode=hybrid');
  });

  // ─── fork ───────────────────────────────────────────────────────────

  it('should fork a thread and prepend to list', async () => {
    const forked = mockThread({ id: 'thread-forked', title: 'Fork of Sales analysis' });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockThread()] })
      .mockResolvedValueOnce({ ok: true, json: async () => forked });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    let fork: Thread | null = null;
    await act(async () => {
      fork = await result.current.fork('thread-1', 'msg-1', 'Fork of Sales analysis');
    });

    expect(fork).toEqual(forked);
    expect(result.current.threads).toHaveLength(2);
    expect(result.current.threads[0]).toEqual(forked);
  });

  it('should post to fork endpoint with correct body', async () => {
    const forked = mockThread({ id: 'thread-fork' });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => forked });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.fork('thread-1', 'msg-1', 'New fork');
    });

    const call = (global.fetch as jest.Mock).mock.calls[1];
    expect(call[0]).toContain('/threads/thread-1/fork');
    expect(call[1].method).toBe('POST');

    const body = JSON.parse(call[1].body);
    expect(body.message_id).toBe('msg-1');
    expect(body.title).toBe('New fork');
  });

  // ─── remove ─────────────────────────────────────────────────────────

  it('should remove a thread and update list', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockThread()] })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    let success = false;
    await act(async () => {
      success = await result.current.remove('thread-1');
    });

    expect(success).toBe(true);
    expect(result.current.threads).toHaveLength(0);
  });

  it('should set error when remove fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockThread()] })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Thread not found' }),
      });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    let success = true;
    await act(async () => {
      success = await result.current.remove('bad-id');
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Thread not found', status: 404 })
    );
    expect(result.current.threads).toHaveLength(1);
  });

  // ─── list ───────────────────────────────────────────────────────────

  it('should list threads with filter options', async () => {
    const threads = [mockThread(), mockThread({ id: 'thread-2', title: 'Other' })];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })       // mount
      .mockResolvedValueOnce({ ok: true, json: async () => threads }); // list call

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let listed: Thread[] = [];
    await act(async () => {
      listed = await result.current.list({ limit: 10, status: 'active' });
    });

    expect(listed).toHaveLength(2);
    expect(result.current.threads).toHaveLength(2);

    const url: string = (global.fetch as jest.Mock).mock.calls[1][0];
    expect(url).toContain('limit=10');
    expect(url).toContain('status=active');
  });

  // ─── refetch ────────────────────────────────────────────────────────

  it('should refetch thread list', async () => {
    const v2 = [mockThread(), mockThread({ id: 'thread-2' })];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockThread()] })
      .mockResolvedValueOnce({ ok: true, json: async () => v2 });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.threads).toHaveLength(2));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ─── branch coverage: error paths ──────────────────────────────────

  it('should set error when get fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Thread not found' }),
      });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let retrieved: ThreadWithMessages | null = undefined as unknown as null;
    await act(async () => {
      retrieved = await result.current.get('bad-id');
    });

    expect(retrieved).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Thread not found', status: 404 })
    );
  });

  it('should set error when appendMessage fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockThread()] })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ detail: 'Invalid message' }),
      });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    let msg: ThreadMessage | null = undefined as unknown as null;
    await act(async () => {
      msg = await result.current.appendMessage('thread-1', { role: 'user', content: '' });
    });

    expect(msg).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Invalid message', status: 400 })
    );
  });

  it('should set error when search fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ detail: 'Search failed' }),
      });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let found: Thread[] = [mockThread()];
    await act(async () => {
      found = await result.current.search('broken query');
    });

    expect(found).toEqual([]);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Search failed', status: 500 })
    );
  });

  it('should set error when fork fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Message not found' }),
      });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let forked: Thread | null = undefined as unknown as null;
    await act(async () => {
      forked = await result.current.fork('thread-1', 'bad-msg-id');
    });

    expect(forked).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Message not found', status: 404 })
    );
  });

  it('should list with search query param', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.list({ search: 'keyword' });
    });

    const url: string = (global.fetch as jest.Mock).mock.calls[1][0];
    expect(url).toContain('search=keyword');
  });

  it('should use fallback error message when response body lacks detail', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => ({}),
    });

    const { result } = renderHook(() => useThread(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.message).toBe('HTTP 502: Bad Gateway');
  });

  it('should handle 204 No Content on remove', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [mockThread()] })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => { throw new Error('no body'); },
      });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.threads).toHaveLength(1));

    let success = false;
    await act(async () => {
      success = await result.current.remove('thread-1');
    });

    expect(success).toBe(true);
  });

  it('should fork without title', async () => {
    const forked = mockThread({ id: 'forked', title: null });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => forked });

    const { result } = renderHook(() => useThread(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let fork: Thread | null = null;
    await act(async () => {
      fork = await result.current.fork('thread-1', 'msg-1');
    });

    expect(fork).toEqual(forked);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(body.title).toBeUndefined();
  });
});
