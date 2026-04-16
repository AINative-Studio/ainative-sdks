/**
 * useThread Hook
 *
 * Provides conversation threading operations via the AINative Threads API.
 * Wraps the /threads endpoints.
 *
 * Refs ainative-website#1102
 */

import { useState, useEffect, useCallback } from 'react';
import { useAINativeContext } from '../AINativeProvider';
import { AINativeError } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Thread {
  id: string;
  title: string | null;
  agent_types: string[];
  model: string | null;
  status: string;
  message_count: number;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ThreadMessage {
  id: string;
  thread_id: string;
  role: string;
  content: string | null;
  tool_calls: unknown[] | null;
  tokens_used: number | null;
  created_at: string;
}

export interface ThreadWithMessages extends Thread {
  messages: ThreadMessage[];
}

export interface CreateThreadRequest {
  title?: string;
  agent_types?: string[];
  model?: string;
  metadata?: Record<string, unknown>;
}

export type SearchMode = 'semantic' | 'keyword' | 'hybrid';

export interface UseThreadReturn {
  threads: Thread[];
  isLoading: boolean;
  error: AINativeError | null;
  create: (title?: string, agentTypes?: string[]) => Promise<Thread | null>;
  get: (threadId: string) => Promise<ThreadWithMessages | null>;
  list: (opts?: { limit?: number; status?: string; search?: string }) => Promise<Thread[]>;
  appendMessage: (
    threadId: string,
    message: { role: string; content: string }
  ) => Promise<ThreadMessage | null>;
  search: (query: string, mode?: SearchMode) => Promise<Thread[]>;
  fork: (threadId: string, fromMessageId: string, title?: string) => Promise<Thread | null>;
  remove: (threadId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook for managing conversation threads.
 *
 * Fetches the thread list on mount and exposes full CRUD plus fork and search.
 *
 * @example
 * ```tsx
 * function ThreadList() {
 *   const { threads, isLoading, error, create, remove } = useThread();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <ul>
 *       {threads.map(t => (
 *         <li key={t.id}>
 *           {t.title ?? 'Untitled'}
 *           <button onClick={() => remove(t.id)}>Delete</button>
 *         </li>
 *       ))}
 *       <button onClick={() => create('New conversation')}>New Thread</button>
 *     </ul>
 *   );
 * }
 * ```
 */
export function useThread(): UseThreadReturn {
  const { config, baseUrl } = useAINativeContext();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AINativeError | null>(null);

  // ─── Shared request helper ──────────────────────────────────────────

  const request = useCallback(
    async <T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> => {
      const url = new URL(`${baseUrl}${path}`);
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }

      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err: AINativeError = {
          message: errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          code: errorData.code,
        };
        throw err;
      }

      if (response.status === 204) return null as T;
      return response.json() as Promise<T>;
    },
    [config.apiKey, baseUrl]
  );

  // ─── list ───────────────────────────────────────────────────────────

  const list = useCallback(
    async (opts?: { limit?: number; status?: string; search?: string }): Promise<Thread[]> => {
      const params: Record<string, string> = {};
      if (opts?.limit !== undefined) params.limit = String(opts.limit);
      if (opts?.status) params.status = opts.status;
      if (opts?.search) params.search = opts.search;

      const data = await request<Thread[]>('GET', '/threads', undefined, params);
      setThreads(data);
      return data;
    },
    [request]
  );

  // ─── Auto-load on mount ─────────────────────────────────────────────

  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await list();
    } catch (err) {
      const e = err as AINativeError;
      const errorObj: AINativeError = {
        message: e.message || 'Failed to fetch threads',
        status: e.status,
        code: e.code,
      };
      setError(errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [list]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // ─── create ─────────────────────────────────────────────────────────

  const create = useCallback(
    async (title?: string, agentTypes?: string[]): Promise<Thread | null> => {
      try {
        const req: CreateThreadRequest = {};
        if (title) req.title = title;
        if (agentTypes) req.agent_types = agentTypes;

        const thread = await request<Thread>('POST', '/threads', req);
        setThreads((prev) => [thread, ...prev]);
        return thread;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to create thread',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return null;
      }
    },
    [request]
  );

  // ─── get ────────────────────────────────────────────────────────────

  const get = useCallback(
    async (threadId: string): Promise<ThreadWithMessages | null> => {
      try {
        return await request<ThreadWithMessages>('GET', `/threads/${threadId}`);
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to get thread',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return null;
      }
    },
    [request]
  );

  // ─── appendMessage ──────────────────────────────────────────────────

  const appendMessage = useCallback(
    async (
      threadId: string,
      message: { role: string; content: string }
    ): Promise<ThreadMessage | null> => {
      try {
        const msg = await request<ThreadMessage>(
          'POST',
          `/threads/${threadId}/messages`,
          message
        );

        // Update message_count on the cached thread
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? { ...t, message_count: t.message_count + 1, last_message_at: msg.created_at }
              : t
          )
        );

        return msg;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to append message',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return null;
      }
    },
    [request]
  );

  // ─── search ─────────────────────────────────────────────────────────

  const search = useCallback(
    async (query: string, mode: SearchMode = 'semantic'): Promise<Thread[]> => {
      try {
        const params: Record<string, string> = { search: query, mode };
        const data = await request<Thread[]>('GET', '/threads', undefined, params);
        return data;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to search threads',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return [];
      }
    },
    [request]
  );

  // ─── fork ───────────────────────────────────────────────────────────

  const fork = useCallback(
    async (threadId: string, fromMessageId: string, title?: string): Promise<Thread | null> => {
      try {
        const thread = await request<Thread>('POST', `/threads/${threadId}/fork`, {
          message_id: fromMessageId,
          ...(title && { title }),
        });
        setThreads((prev) => [thread, ...prev]);
        return thread;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to fork thread',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return null;
      }
    },
    [request]
  );

  // ─── remove ─────────────────────────────────────────────────────────

  const remove = useCallback(
    async (threadId: string): Promise<boolean> => {
      try {
        await request<void>('DELETE', `/threads/${threadId}`);
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        return true;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to delete thread',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return false;
      }
    },
    [request]
  );

  return {
    threads,
    isLoading,
    error,
    create,
    get,
    list,
    appendMessage,
    search,
    fork,
    remove,
    refetch: fetchThreads,
  };
}
