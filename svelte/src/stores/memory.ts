/**
 * createMemory Store
 *
 * Provides ZeroMemory operations: remember, recall, forget.
 * Wraps the /public/memory/v2 endpoints.
 *
 * Refs ainative-website#1103
 */

import { writable, derived, get } from 'svelte/store';
import { ainativeConfig } from './config';
import type { AINativeError } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Memory {
  id: string;
  content: string;
  memory_type: string;
  importance: number;
  tags: string[];
  entity_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  score?: number;
}

export interface RememberOptions {
  entity_id?: string;
  memory_type?: string;
  importance?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface RecallOptions {
  entity_id?: string;
  layer?: string;
  limit?: number;
}

export interface MemoryOptions {
  entityId?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface MemoryState {
  memories: Memory[];
  isLoading: boolean;
  error: AINativeError | null;
}

// ─── Store factory ────────────────────────────────────────────────────────────

/**
 * Creates a Svelte store for ZeroMemory operations scoped to an optional entity.
 *
 * When `entityId` is provided the store automatically fetches memories for
 * that entity on init by running a broad recall. Without an `entityId` the
 * memories list starts empty and is populated lazily via `recall`.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createMemory } from '@ainative/svelte-sdk';
 *
 *   const memStore = createMemory({ entityId: 'user-123' });
 *   const { memories, isLoading, error } = memStore;
 *
 *   async function save() {
 *     await memStore.remember('User prefers dark mode', { tags: ['preference'] });
 *   }
 * </script>
 *
 * {#each $memories as m}
 *   <div>{m.content} <button on:click={() => memStore.forget(m.id)}>Forget</button></div>
 * {/each}
 * ```
 */
export function createMemory(options: MemoryOptions = {}) {
  const { entityId } = options;

  const initialState: MemoryState = {
    memories: [],
    isLoading: !!entityId,
    error: null,
  };

  const store = writable<MemoryState>(initialState);
  const { subscribe, update } = store;

  // ─── Shared request helper ──────────────────────────────────────────

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const config = get(ainativeConfig);
    const baseUrl = options.baseUrl || config.baseUrl || 'https://api.ainative.studio';
    const apiKey = options.apiKey || config.apiKey;

    const response = await fetch(`${baseUrl}/api/v1${path}`, {
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

  // ─── recall ─────────────────────────────────────────────────────────

  async function recall(query: string, recallOptions?: RecallOptions): Promise<Memory[]> {
    try {
      const data = await request<Memory[]>('POST', '/public/memory/v2/recall', {
        query,
        ...(recallOptions?.entity_id && { entity_id: recallOptions.entity_id }),
        ...(entityId && !recallOptions?.entity_id && { entity_id: entityId }),
        ...(recallOptions?.layer && { layer: recallOptions.layer }),
        ...(recallOptions?.limit !== undefined && { limit: recallOptions.limit }),
      });
      update(s => ({ ...s, memories: data }));
      return data;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to recall memories', status: e.status, code: e.code },
      }));
      return [];
    }
  }

  // ─── Auto-load entity memories on init ─────────────────────────────

  async function fetchEntityMemories(): Promise<void> {
    if (!entityId) return;
    update(s => ({ ...s, isLoading: true, error: null }));

    try {
      const data = await request<Memory[]>('POST', '/public/memory/v2/recall', {
        query: '',
        entity_id: entityId,
      });
      update(s => ({ ...s, memories: data, isLoading: false }));
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        isLoading: false,
        error: { message: e.message || 'Failed to fetch memories', status: e.status, code: e.code },
      }));
    }
  }

  if (entityId) {
    fetchEntityMemories();
  }

  // ─── remember ───────────────────────────────────────────────────────

  async function remember(content: string, rememberOptions?: RememberOptions): Promise<Memory | null> {
    try {
      const data = await request<Memory>('POST', '/public/memory/v2/remember', {
        content,
        ...(rememberOptions?.entity_id && { entity_id: rememberOptions.entity_id }),
        ...(entityId && !rememberOptions?.entity_id && { entity_id: entityId }),
        ...(rememberOptions?.memory_type && { memory_type: rememberOptions.memory_type }),
        ...(rememberOptions?.importance !== undefined && { importance: rememberOptions.importance }),
        ...(rememberOptions?.tags && { tags: rememberOptions.tags }),
        ...(rememberOptions?.metadata && { metadata: rememberOptions.metadata }),
      });
      update(s => ({ ...s, memories: [data, ...s.memories] }));
      return data;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to remember', status: e.status, code: e.code },
      }));
      return null;
    }
  }

  // ─── forget ─────────────────────────────────────────────────────────

  async function forget(memoryId: string): Promise<boolean> {
    try {
      await request<void>('DELETE', `/public/memory/v2/forget/${memoryId}`);
      update(s => ({ ...s, memories: s.memories.filter(m => m.id !== memoryId) }));
      return true;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to forget memory', status: e.status, code: e.code },
      }));
      return false;
    }
  }

  return {
    subscribe,
    memories: derived(store, $s => $s.memories),
    isLoading: derived(store, $s => $s.isLoading),
    error: derived(store, $s => $s.error),
    remember,
    recall,
    forget,
    refetch: fetchEntityMemories,
  };
}
