/**
 * useMemory Hook
 *
 * Provides ZeroMemory operations: remember, recall, forget, and entity-scoped recall.
 * Wraps the /public/memory/v2 endpoints.
 *
 * Refs ainative-website#1102
 */

import { useState, useEffect, useCallback } from 'react';
import { useAINativeContext } from '../AINativeProvider';
import { AINativeError } from '../types';

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
  memories: Memory[];
  isLoading: boolean;
  error: AINativeError | null;
  remember: (content: string, options?: RememberOptions) => Promise<Memory | null>;
  recall: (query: string, options?: RecallOptions) => Promise<Memory[]>;
  forget: (memoryId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook for ZeroMemory operations scoped to an optional entity.
 *
 * When `entityId` is provided the hook automatically fetches memories for
 * that entity on mount by running a broad recall. Without an `entityId` the
 * memories list starts empty and is populated lazily via `recall`.
 *
 * @param entityId - Optional entity to scope memory operations to.
 *
 * @example
 * ```tsx
 * function MemoryPanel({ userId }: { userId: string }) {
 *   const { memories, remember, recall, forget, isLoading } = useMemory(userId);
 *
 *   const handleSave = async () => {
 *     await remember('User prefers dark mode', { tags: ['preference'] });
 *   };
 *
 *   return (
 *     <div>
 *       {memories.map(m => (
 *         <div key={m.id}>
 *           {m.content}
 *           <button onClick={() => forget(m.id)}>Forget</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useMemory(entityId?: string): UseMemoryReturn {
  const { config, baseUrl } = useAINativeContext();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(!!entityId);
  const [error, setError] = useState<AINativeError | null>(null);

  // ─── Shared request helper ──────────────────────────────────────────

  const request = useCallback(
    async <T>(method: string, path: string, body?: unknown): Promise<T> => {
      const response = await fetch(`${baseUrl}${path}`, {
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

  // ─── recall ─────────────────────────────────────────────────────────

  const recall = useCallback(
    async (query: string, options?: RecallOptions): Promise<Memory[]> => {
      try {
        const data = await request<Memory[]>('POST', '/public/memory/v2/recall', {
          query,
          ...(options?.entity_id && { entity_id: options.entity_id }),
          ...(entityId && !options?.entity_id && { entity_id: entityId }),
          ...(options?.layer && { layer: options.layer }),
          ...(options?.limit !== undefined && { limit: options.limit }),
        });
        setMemories(data);
        return data;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to recall memories',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return [];
      }
    },
    [request, entityId]
  );

  // ─── Auto-load entity memories on mount ────────────────────────────

  const fetchEntityMemories = useCallback(async () => {
    if (!entityId) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await request<Memory[]>('POST', '/public/memory/v2/recall', {
        query: '',
        entity_id: entityId,
      });
      setMemories(data);
    } catch (err) {
      const e = err as AINativeError;
      const errorObj: AINativeError = {
        message: e.message || 'Failed to fetch memories',
        status: e.status,
        code: e.code,
      };
      setError(errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [request, entityId]);

  useEffect(() => {
    fetchEntityMemories();
  }, [fetchEntityMemories]);

  // ─── remember ───────────────────────────────────────────────────────

  const remember = useCallback(
    async (content: string, options?: RememberOptions): Promise<Memory | null> => {
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
        setMemories((prev) => [data, ...prev]);
        return data;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to remember',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return null;
      }
    },
    [request, entityId]
  );

  // ─── forget ─────────────────────────────────────────────────────────

  const forget = useCallback(
    async (memoryId: string): Promise<boolean> => {
      try {
        await request<void>('DELETE', `/public/memory/v2/forget/${memoryId}`);
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        return true;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to forget memory',
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
    memories,
    isLoading,
    error,
    remember,
    recall,
    forget,
    refetch: fetchEntityMemories,
  };
}
