/**
 * useMemory Composable
 *
 * Provides ZeroMemory operations: remember, recall, forget.
 * Wraps the /public/memory/v2 endpoints.
 *
 * Refs ainative-website#1104
 */

import { ref, onMounted, type Ref } from 'vue';
import { useAINative } from './useAINative';
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

export interface UseMemoryReturn {
  memories: Ref<Memory[]>;
  isLoading: Ref<boolean>;
  error: Ref<AINativeError | null>;
  remember: (content: string, options?: RememberOptions) => Promise<Memory | null>;
  recall: (query: string, options?: RecallOptions) => Promise<Memory[]>;
  forget: (memoryId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Composable for ZeroMemory operations scoped to an optional entity.
 *
 * When `entityId` is provided the composable automatically fetches memories for
 * that entity on mount by running a broad recall. Without an `entityId` the
 * memories list starts empty and is populated lazily via `recall`.
 *
 * @param entityId - Optional entity to scope memory operations to.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useMemory } from '@ainative/vue-sdk';
 *
 * const { memories, remember, recall, forget, isLoading } = useMemory('user-123');
 *
 * async function save() {
 *   await remember('User prefers dark mode', { tags: ['preference'] });
 * }
 * </script>
 *
 * <template>
 *   <div v-for="m in memories" :key="m.id">
 *     {{ m.content }}
 *     <button @click="forget(m.id)">Forget</button>
 *   </div>
 * </template>
 * ```
 */
export function useMemory(entityId?: string): UseMemoryReturn {
  const config = useAINative();
  const baseUrl = config.baseUrl || 'https://api.ainative.studio';
  const apiKey = config.apiKey;

  const memories = ref<Memory[]>([]);
  const isLoading = ref(!!entityId);
  const error = ref<AINativeError | null>(null);

  // ─── Shared request helper ──────────────────────────────────────────

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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

  async function recall(query: string, options?: RecallOptions): Promise<Memory[]> {
    try {
      const data = await request<Memory[]>('POST', '/public/memory/v2/recall', {
        query,
        ...(options?.entity_id && { entity_id: options.entity_id }),
        ...(entityId && !options?.entity_id && { entity_id: entityId }),
        ...(options?.layer && { layer: options.layer }),
        ...(options?.limit !== undefined && { limit: options.limit }),
      });
      memories.value = data;
      return data;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to recall memories',
        status: e.status,
        code: e.code,
      };
      return [];
    }
  }

  // ─── Auto-load entity memories on mount ────────────────────────────

  async function fetchEntityMemories(): Promise<void> {
    if (!entityId) return;
    isLoading.value = true;
    error.value = null;

    try {
      const data = await request<Memory[]>('POST', '/public/memory/v2/recall', {
        query: '',
        entity_id: entityId,
      });
      memories.value = data;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to fetch memories',
        status: e.status,
        code: e.code,
      };
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(fetchEntityMemories);

  // ─── remember ───────────────────────────────────────────────────────

  async function remember(content: string, options?: RememberOptions): Promise<Memory | null> {
    try {
      const data = await request<Memory>('POST', '/public/memory/v2/remember', {
        content,
        ...(options?.entity_id && { entity_id: options.entity_id }),
        ...(entityId && !options?.entity_id && { entity_id: entityId }),
        ...(options?.memory_type && { memory_type: options.memory_type }),
        ...(options?.importance !== undefined && { importance: options.importance }),
        ...(options?.tags && { tags: options.tags }),
        ...(options?.metadata && { metadata: options.metadata }),
      });
      memories.value = [data, ...memories.value];
      return data;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to remember',
        status: e.status,
        code: e.code,
      };
      return null;
    }
  }

  // ─── forget ─────────────────────────────────────────────────────────

  async function forget(memoryId: string): Promise<boolean> {
    try {
      await request<void>('DELETE', `/public/memory/v2/forget/${memoryId}`);
      memories.value = memories.value.filter(m => m.id !== memoryId);
      return true;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to forget memory',
        status: e.status,
        code: e.code,
      };
      return false;
    }
  }

  return {
    memories,
    isLoading,
    error,
    remember,
    recall,
    forget,
    refetch: fetchEntityMemories,
  };
}
