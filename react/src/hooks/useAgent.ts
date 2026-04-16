/**
 * useAgent Hook
 *
 * Provides agent CRUD and lifecycle management via the AINative Agent API.
 * Wraps the /auth/agents endpoints.
 *
 * Refs ainative-website#1102
 */

import { useState, useEffect, useCallback } from 'react';
import { useAINativeContext } from '../AINativeProvider';
import { AINativeError } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentRegistration {
  id: string;
  name: string;
  agent_type: string;
  model?: string;
  capabilities: string[];
  oversight_level: string;
  status: string;
  created_at: string;
}

export interface CreateAgentRequest {
  name: string;
  agent_type: string;
  model?: string;
  capabilities: string[];
  oversight_level?: string;
}

export interface UseAgentReturn {
  agents: AgentRegistration[];
  isLoading: boolean;
  error: AINativeError | null;
  create: (config: CreateAgentRequest) => Promise<AgentRegistration | null>;
  get: (id: string) => Promise<AgentRegistration | null>;
  list: () => Promise<AgentRegistration[]>;
  remove: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook for managing AINative agent registrations.
 *
 * @example
 * ```tsx
 * function AgentManager() {
 *   const { agents, isLoading, error, create, remove, refetch } = useAgent();
 *
 *   const handleCreate = async () => {
 *     await create({
 *       name: 'My Agent',
 *       agent_type: 'assistant',
 *       capabilities: ['chat', 'code'],
 *     });
 *     await refetch();
 *   };
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <ul>
 *       {agents.map(a => (
 *         <li key={a.id}>
 *           {a.name}
 *           <button onClick={() => remove(a.id)}>Delete</button>
 *         </li>
 *       ))}
 *       <button onClick={handleCreate}>Add Agent</button>
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAgent(): UseAgentReturn {
  const { config, baseUrl } = useAINativeContext();
  const [agents, setAgents] = useState<AgentRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // ─── list ───────────────────────────────────────────────────────────

  const list = useCallback(async (): Promise<AgentRegistration[]> => {
    const data = await request<AgentRegistration[]>('GET', '/auth/agents');
    return data;
  }, [request]);

  // ─── Internal fetch for auto-load ───────────────────────────────────

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await list();
      setAgents(data);
    } catch (err) {
      const e = err as AINativeError;
      const errorObj: AINativeError = {
        message: e.message || 'Failed to fetch agents',
        status: e.status,
        code: e.code,
      };
      setError(errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [list]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // ─── create ─────────────────────────────────────────────────────────

  const create = useCallback(
    async (agentConfig: CreateAgentRequest): Promise<AgentRegistration | null> => {
      try {
        const data = await request<AgentRegistration>(
          'POST',
          '/auth/agents/register',
          agentConfig
        );
        setAgents((prev) => [...prev, data]);
        return data;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to create agent',
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
    async (id: string): Promise<AgentRegistration | null> => {
      try {
        return await request<AgentRegistration>('GET', `/auth/agents/${id}`);
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to get agent',
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
    async (id: string): Promise<boolean> => {
      try {
        await request<void>('DELETE', `/auth/agents/${id}`);
        setAgents((prev) => prev.filter((a) => a.id !== id));
        return true;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to delete agent',
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
    agents,
    isLoading,
    error,
    create,
    get,
    list,
    remove,
    refetch: fetchAgents,
  };
}
