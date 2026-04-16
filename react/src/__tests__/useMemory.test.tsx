/**
 * Tests for useMemory hook
 *
 * Refs ainative-website#1102
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AINativeProvider } from '../AINativeProvider';
import { useMemory } from '../hooks/useMemory';
import type { Memory } from '../hooks/useMemory';

// Mock fetch
global.fetch = jest.fn();

const mockMemory = (overrides: Partial<Memory> = {}): Memory => ({
  id: 'mem-1',
  content: 'User prefers dark mode',
  memory_type: 'preference',
  importance: 0.8,
  tags: ['preference', 'ui'],
  entity_id: 'user-123',
  metadata: {},
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('useMemory', () => {
  const mockConfig = { apiKey: 'test-api-key' };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AINativeProvider config={mockConfig}>{children}</AINativeProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Without entityId ───────────────────────────────────────────────

  describe('without entityId', () => {
    it('should start not loading with empty memories', () => {
      const { result } = renderHook(() => useMemory(), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.memories).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should not call API on mount', () => {
      renderHook(() => useMemory(), { wrapper });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ─── With entityId ──────────────────────────────────────────────────

  describe('with entityId', () => {
    it('should fetch entity memories on mount', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockMemory()],
      });

      const { result } = renderHook(() => useMemory('user-123'), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.memories).toHaveLength(1);
      expect(result.current.memories[0]).toEqual(mockMemory());
      expect(result.current.error).toBeNull();
    });

    it('should pass entity_id in recall body on mount', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      renderHook(() => useMemory('user-123'), { wrapper });

      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.entity_id).toBe('user-123');
    });

    it('should handle fetch error on mount', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ detail: 'Access denied' }),
      });

      const { result } = renderHook(() => useMemory('user-x'), { wrapper });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.memories).toHaveLength(0);
      expect(result.current.error).toEqual(
        expect.objectContaining({ message: 'Access denied', status: 403 })
      );
    });
  });

  // ─── remember ───────────────────────────────────────────────────────

  it('should remember content and prepend to memories', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMemory(),
    });

    const { result } = renderHook(() => useMemory(), { wrapper });

    let mem: Memory | null = null;
    await act(async () => {
      mem = await result.current.remember('User prefers dark mode', {
        tags: ['preference'],
        importance: 0.8,
      });
    });

    expect(mem).toEqual(mockMemory());
    expect(result.current.memories).toHaveLength(1);
    expect(result.current.memories[0]).toEqual(mockMemory());
  });

  it('should post to correct remember endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMemory(),
    });

    const { result } = renderHook(() => useMemory(), { wrapper });

    await act(async () => {
      await result.current.remember('Test content');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.ainative.studio/api/v1/public/memory/v2/remember',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should include implicit entity_id from hook param when remembering', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })          // mount recall
      .mockResolvedValueOnce({ ok: true, json: async () => mockMemory() }); // remember

    const { result } = renderHook(() => useMemory('user-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.remember('Content');
    });

    const rememberCall = (global.fetch as jest.Mock).mock.calls[1];
    const body = JSON.parse(rememberCall[1].body);
    expect(body.entity_id).toBe('user-123');
  });

  it('should set error when remember fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ detail: 'Content too long' }),
    });

    const { result } = renderHook(() => useMemory(), { wrapper });

    let mem: Memory | null = undefined as unknown as null;
    await act(async () => {
      mem = await result.current.remember('x'.repeat(10000));
    });

    expect(mem).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Content too long', status: 422 })
    );
  });

  // ─── recall ─────────────────────────────────────────────────────────

  it('should recall memories and update state', async () => {
    const memories = [mockMemory(), mockMemory({ id: 'mem-2', content: 'Second' })];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => memories,
    });

    const { result } = renderHook(() => useMemory(), { wrapper });

    let recalled: Memory[] = [];
    await act(async () => {
      recalled = await result.current.recall('dark mode preferences');
    });

    expect(recalled).toHaveLength(2);
    expect(result.current.memories).toHaveLength(2);
  });

  it('should pass recall options in request body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useMemory(), { wrapper });

    await act(async () => {
      await result.current.recall('query', { layer: 'episodic', limit: 5 });
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.query).toBe('query');
    expect(body.layer).toBe('episodic');
    expect(body.limit).toBe(5);
  });

  it('should return empty array and set error when recall fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useMemory(), { wrapper });

    let recalled: Memory[] = [mockMemory()];
    await act(async () => {
      recalled = await result.current.recall('anything');
    });

    expect(recalled).toEqual([]);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Network error' })
    );
  });

  // ─── forget ─────────────────────────────────────────────────────────

  it('should forget a memory and remove from list', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockMemory() })  // remember
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null }); // forget

    const { result } = renderHook(() => useMemory(), { wrapper });

    await act(async () => {
      await result.current.remember('Something');
    });

    expect(result.current.memories).toHaveLength(1);

    let success = false;
    await act(async () => {
      success = await result.current.forget('mem-1');
    });

    expect(success).toBe(true);
    expect(result.current.memories).toHaveLength(0);
  });

  it('should call correct forget endpoint', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockMemory() })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const { result } = renderHook(() => useMemory(), { wrapper });

    await act(async () => {
      await result.current.remember('Content');
    });

    await act(async () => {
      await result.current.forget('mem-1');
    });

    expect(global.fetch).toHaveBeenLastCalledWith(
      'https://api.ainative.studio/api/v1/public/memory/v2/forget/mem-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('should set error when forget fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ detail: 'Memory not found' }),
    });

    const { result } = renderHook(() => useMemory(), { wrapper });

    let success = true;
    await act(async () => {
      success = await result.current.forget('bad-id');
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Memory not found', status: 404 })
    );
  });

  // ─── refetch ────────────────────────────────────────────────────────

  it('should refetch memories for entityId when refetch is called', async () => {
    const v1 = [mockMemory()];
    const v2 = [mockMemory(), mockMemory({ id: 'mem-2' })];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => v1 })
      .mockResolvedValueOnce({ ok: true, json: async () => v2 });

    const { result } = renderHook(() => useMemory('user-123'), { wrapper });

    await waitFor(() => expect(result.current.memories).toHaveLength(1));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.memories).toHaveLength(2));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // ─── branch coverage: option overrides ─────────────────────────────

  it('should use explicit entity_id in recall options over implicit entityId', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })  // mount for 'user-123'
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // recall with override

    const { result } = renderHook(() => useMemory('user-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.recall('test query', { entity_id: 'override-entity' });
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(body.entity_id).toBe('override-entity');
  });

  it('should use explicit entity_id in remember options over implicit entityId', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })      // mount
      .mockResolvedValueOnce({ ok: true, json: async () => mockMemory({ entity_id: 'override-entity' }) }); // remember

    const { result } = renderHook(() => useMemory('user-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.remember('content', { entity_id: 'override-entity' });
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(body.entity_id).toBe('override-entity');
  });

  it('should include all remember options in request body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMemory(),
    });

    const { result } = renderHook(() => useMemory(), { wrapper });

    await act(async () => {
      await result.current.remember('content', {
        memory_type: 'fact',
        importance: 0.9,
        tags: ['important'],
        metadata: { source: 'manual' },
      });
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.memory_type).toBe('fact');
    expect(body.importance).toBe(0.9);
    expect(body.tags).toEqual(['important']);
    expect(body.metadata).toEqual({ source: 'manual' });
  });

  it('should include entity_id in recall body when entityId is set but no override provided', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })  // mount
      .mockResolvedValueOnce({ ok: true, json: async () => [] }); // recall

    const { result } = renderHook(() => useMemory('user-123'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.recall('query with layer', { layer: 'episodic' });
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(body.entity_id).toBe('user-123');
    expect(body.layer).toBe('episodic');
  });

  it('should use fallback error message when response body lacks detail', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({}),
    });

    const { result } = renderHook(() => useMemory('user-x'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error?.message).toBe('HTTP 503: Service Unavailable');
  });

  it('should handle 204 No Content on forget', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockMemory() })  // remember
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => { throw new Error('no body'); },
      });

    const { result } = renderHook(() => useMemory(), { wrapper });

    await act(async () => {
      await result.current.remember('Something');
    });

    let success = false;
    await act(async () => {
      success = await result.current.forget('mem-1');
    });

    expect(success).toBe(true);
  });

  it('should include limit in recall options', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { result } = renderHook(() => useMemory(), { wrapper });

    await act(async () => {
      await result.current.recall('query', { limit: 10 });
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.limit).toBe(10);
  });
});
