/**
 * useAgent Composable
 *
 * Provides agent CRUD and lifecycle management via the AINative Agent API.
 * Wraps the /auth/agents endpoints.
 *
 * Refs ainative-website#1104
 */

import { ref, onMounted, type Ref } from 'vue';
import { useAINative } from './useAINative';
import type { AINativeError } from '../types';

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

export interface UseAgentOptions {
  baseUrl?: string;
  apiKey?: string;
}

export interface UseAgentReturn {
  agents: Ref<AgentRegistration[]>;
  isLoading: Ref<boolean>;
  error: Ref<AINativeError | null>;
  create: (config: CreateAgentRequest) => Promise<AgentRegistration | null>;
  get: (id: string) => Promise<AgentRegistration | null>;
  list: () => Promise<AgentRegistration[]>;
  remove: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Composable for managing AINative agent registrations.
 *
 * Auto-loads the agent list on mount.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useAgent } from '@ainative/vue-sdk';
 *
 * const { agents, isLoading, error, create, remove } = useAgent();
 *
 * async function handleCreate() {
 *   await create({ name: 'My Agent', agent_type: 'assistant', capabilities: ['chat'] });
 * }
 * </script>
 *
 * <template>
 *   <ul v-if="!isLoading">
 *     <li v-for="agent in agents" :key="agent.id">
 *       {{ agent.name }}
 *       <button @click="remove(agent.id)">Delete</button>
 *     </li>
 *   </ul>
 *   <button @click="handleCreate">Add Agent</button>
 * </template>
 * ```
 */
export function useAgent(options: UseAgentOptions = {}): UseAgentReturn {
  const config = useAINative();
  const baseUrl = options.baseUrl || config.baseUrl || 'https://api.ainative.studio';
  const apiKey = options.apiKey || config.apiKey;

  const agents = ref<AgentRegistration[]>([]);
  const isLoading = ref(true);
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

  // ─── list ───────────────────────────────────────────────────────────

  async function list(): Promise<AgentRegistration[]> {
    return request<AgentRegistration[]>('GET', '/auth/agents');
  }

  // ─── Auto-load on mount ─────────────────────────────────────────────

  async function fetchAgents(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const data = await list();
      agents.value = data;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to fetch agents',
        status: e.status,
        code: e.code,
      };
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(fetchAgents);

  // ─── create ─────────────────────────────────────────────────────────

  async function create(agentConfig: CreateAgentRequest): Promise<AgentRegistration | null> {
    try {
      const data = await request<AgentRegistration>('POST', '/auth/agents/register', agentConfig);
      agents.value = [...agents.value, data];
      return data;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to create agent',
        status: e.status,
        code: e.code,
      };
      return null;
    }
  }

  // ─── get ────────────────────────────────────────────────────────────

  async function get(id: string): Promise<AgentRegistration | null> {
    try {
      return await request<AgentRegistration>('GET', `/auth/agents/${id}`);
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to get agent',
        status: e.status,
        code: e.code,
      };
      return null;
    }
  }

  // ─── remove ─────────────────────────────────────────────────────────

  async function remove(id: string): Promise<boolean> {
    try {
      await request<void>('DELETE', `/auth/agents/${id}`);
      agents.value = agents.value.filter(a => a.id !== id);
      return true;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to delete agent',
        status: e.status,
        code: e.code,
      };
      return false;
    }
  }

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
