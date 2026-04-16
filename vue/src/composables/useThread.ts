/**
 * useThread Composable
 *
 * Provides conversation threading operations via the AINative Threads API.
 * Wraps the /threads endpoints.
 *
 * Refs ainative-website#1104
 */

import { ref, onMounted, type Ref } from 'vue';
import { useAINative } from './useAINative';
import type { AINativeError } from '../types';

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

export interface UseThreadOptions {
  baseUrl?: string;
  apiKey?: string;
}

export interface UseThreadReturn {
  threads: Ref<Thread[]>;
  isLoading: Ref<boolean>;
  error: Ref<AINativeError | null>;
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

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Composable for managing conversation threads.
 *
 * Fetches the thread list on mount and exposes full CRUD plus fork and search.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useThread } from '@ainative/vue-sdk';
 *
 * const { threads, isLoading, error, create, remove } = useThread();
 * </script>
 *
 * <template>
 *   <ul v-if="!isLoading">
 *     <li v-for="t in threads" :key="t.id">
 *       {{ t.title ?? 'Untitled' }}
 *       <button @click="remove(t.id)">Delete</button>
 *     </li>
 *   </ul>
 *   <button @click="create('New conversation')">New Thread</button>
 * </template>
 * ```
 */
export function useThread(options: UseThreadOptions = {}): UseThreadReturn {
  const config = useAINative();
  const baseUrl = options.baseUrl || config.baseUrl || 'https://api.ainative.studio';
  const apiKey = options.apiKey || config.apiKey;

  const threads = ref<Thread[]>([]);
  const isLoading = ref(true);
  const error = ref<AINativeError | null>(null);

  // ─── Shared request helper ──────────────────────────────────────────

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${baseUrl}/api/v1${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
  }

  // ─── list ───────────────────────────────────────────────────────────

  async function list(opts?: {
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<Thread[]> {
    const params: Record<string, string> = {};
    if (opts?.limit !== undefined) params.limit = String(opts.limit);
    if (opts?.status) params.status = opts.status;
    if (opts?.search) params.search = opts.search;

    const data = await request<Thread[]>('GET', '/threads', undefined, params);
    threads.value = data;
    return data;
  }

  // ─── Auto-load on mount ─────────────────────────────────────────────

  async function fetchThreads(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await list();
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to fetch threads',
        status: e.status,
        code: e.code,
      };
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(fetchThreads);

  // ─── create ─────────────────────────────────────────────────────────

  async function create(title?: string, agentTypes?: string[]): Promise<Thread | null> {
    try {
      const req: CreateThreadRequest = {};
      if (title) req.title = title;
      if (agentTypes) req.agent_types = agentTypes;

      const thread = await request<Thread>('POST', '/threads', req);
      threads.value = [thread, ...threads.value];
      return thread;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to create thread',
        status: e.status,
        code: e.code,
      };
      return null;
    }
  }

  // ─── get ────────────────────────────────────────────────────────────

  async function get(threadId: string): Promise<ThreadWithMessages | null> {
    try {
      return await request<ThreadWithMessages>('GET', `/threads/${threadId}`);
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to get thread',
        status: e.status,
        code: e.code,
      };
      return null;
    }
  }

  // ─── appendMessage ──────────────────────────────────────────────────

  async function appendMessage(
    threadId: string,
    message: { role: string; content: string }
  ): Promise<ThreadMessage | null> {
    try {
      const msg = await request<ThreadMessage>('POST', `/threads/${threadId}/messages`, message);

      threads.value = threads.value.map(t =>
        t.id === threadId
          ? { ...t, message_count: t.message_count + 1, last_message_at: msg.created_at }
          : t
      );

      return msg;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to append message',
        status: e.status,
        code: e.code,
      };
      return null;
    }
  }

  // ─── search ─────────────────────────────────────────────────────────

  async function search(query: string, mode: SearchMode = 'semantic'): Promise<Thread[]> {
    try {
      const params: Record<string, string> = { search: query, mode };
      return await request<Thread[]>('GET', '/threads', undefined, params);
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to search threads',
        status: e.status,
        code: e.code,
      };
      return [];
    }
  }

  // ─── fork ───────────────────────────────────────────────────────────

  async function fork(
    threadId: string,
    fromMessageId: string,
    title?: string
  ): Promise<Thread | null> {
    try {
      const thread = await request<Thread>('POST', `/threads/${threadId}/fork`, {
        message_id: fromMessageId,
        ...(title && { title }),
      });
      threads.value = [thread, ...threads.value];
      return thread;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to fork thread',
        status: e.status,
        code: e.code,
      };
      return null;
    }
  }

  // ─── remove ─────────────────────────────────────────────────────────

  async function remove(threadId: string): Promise<boolean> {
    try {
      await request<void>('DELETE', `/threads/${threadId}`);
      threads.value = threads.value.filter(t => t.id !== threadId);
      return true;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to delete thread',
        status: e.status,
        code: e.code,
      };
      return false;
    }
  }

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
