/**
 * createThread Store
 *
 * Provides conversation threading operations via the AINative Threads API.
 * Wraps the /threads endpoints.
 *
 * Refs ainative-website#1103
 */

import { writable, derived, get } from 'svelte/store';
import { ainativeConfig } from './config';
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

export interface ThreadOptions {
  baseUrl?: string;
  apiKey?: string;
}

export interface ThreadState {
  threads: Thread[];
  isLoading: boolean;
  error: AINativeError | null;
}

// ─── Store factory ────────────────────────────────────────────────────────────

/**
 * Creates a Svelte store for managing conversation threads.
 *
 * Fetches the thread list on init and exposes full CRUD plus fork and search.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createThread } from '@ainative/svelte-sdk';
 *
 *   const threadStore = createThread();
 *   const { threads, isLoading, error } = threadStore;
 * </script>
 *
 * {#if $isLoading}<p>Loading...</p>{/if}
 * {#each $threads as t}
 *   <li>{t.title ?? 'Untitled'}
 *     <button on:click={() => threadStore.remove(t.id)}>Delete</button>
 *   </li>
 * {/each}
 * <button on:click={() => threadStore.create('New conversation')}>New Thread</button>
 * ```
 */
export function createThread(options: ThreadOptions = {}) {
  const initialState: ThreadState = {
    threads: [],
    isLoading: true,
    error: null,
  };

  const store = writable<ThreadState>(initialState);
  const { subscribe, update } = store;

  // ─── Shared request helper ──────────────────────────────────────────

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    const config = get(ainativeConfig);
    const baseUrl = options.baseUrl || config.baseUrl || 'https://api.ainative.studio';
    const apiKey = options.apiKey || config.apiKey;

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
    update(s => ({ ...s, threads: data }));
    return data;
  }

  // ─── Auto-load on init ──────────────────────────────────────────────

  async function fetchThreads(): Promise<void> {
    update(s => ({ ...s, isLoading: true, error: null }));

    try {
      await list();
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to fetch threads', status: e.status, code: e.code },
      }));
    } finally {
      update(s => ({ ...s, isLoading: false }));
    }
  }

  fetchThreads();

  // ─── create ─────────────────────────────────────────────────────────

  async function create(title?: string, agentTypes?: string[]): Promise<Thread | null> {
    try {
      const req: CreateThreadRequest = {};
      if (title) req.title = title;
      if (agentTypes) req.agent_types = agentTypes;

      const thread = await request<Thread>('POST', '/threads', req);
      update(s => ({ ...s, threads: [thread, ...s.threads] }));
      return thread;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to create thread', status: e.status, code: e.code },
      }));
      return null;
    }
  }

  // ─── get ────────────────────────────────────────────────────────────

  async function getThread(threadId: string): Promise<ThreadWithMessages | null> {
    try {
      return await request<ThreadWithMessages>('GET', `/threads/${threadId}`);
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to get thread', status: e.status, code: e.code },
      }));
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

      update(s => ({
        ...s,
        threads: s.threads.map(t =>
          t.id === threadId
            ? { ...t, message_count: t.message_count + 1, last_message_at: msg.created_at }
            : t
        ),
      }));

      return msg;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: {
          message: e.message || 'Failed to append message',
          status: e.status,
          code: e.code,
        },
      }));
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
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to search threads', status: e.status, code: e.code },
      }));
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
      update(s => ({ ...s, threads: [thread, ...s.threads] }));
      return thread;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to fork thread', status: e.status, code: e.code },
      }));
      return null;
    }
  }

  // ─── remove ─────────────────────────────────────────────────────────

  async function remove(threadId: string): Promise<boolean> {
    try {
      await request<void>('DELETE', `/threads/${threadId}`);
      update(s => ({ ...s, threads: s.threads.filter(t => t.id !== threadId) }));
      return true;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to delete thread', status: e.status, code: e.code },
      }));
      return false;
    }
  }

  return {
    subscribe,
    threads: derived(store, $s => $s.threads),
    isLoading: derived(store, $s => $s.isLoading),
    error: derived(store, $s => $s.error),
    create,
    get: getThread,
    list,
    appendMessage,
    search,
    fork,
    remove,
    refetch: fetchThreads,
  };
}
