/**
 * createAgent Store
 *
 * Provides agent CRUD and lifecycle management via the AINative Agent API.
 * Wraps the /auth/agents endpoints.
 *
 * Refs ainative-website#1103
 */

import { writable, derived, get } from 'svelte/store';
import { ainativeConfig } from './config';
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

export interface AgentOptions {
  baseUrl?: string;
  apiKey?: string;
}

export interface AgentState {
  agents: AgentRegistration[];
  isLoading: boolean;
  error: AINativeError | null;
}

// ─── Store factory ────────────────────────────────────────────────────────────

/**
 * Creates a Svelte store for managing AINative agent registrations.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createAgent } from '@ainative/svelte-sdk';
 *
 *   const agentStore = createAgent();
 *   const { agents, isLoading, error, create, remove } = agentStore;
 *
 *   async function handleCreate() {
 *     await agentStore.create({ name: 'My Agent', agent_type: 'assistant', capabilities: ['chat'] });
 *   }
 * </script>
 *
 * {#if $isLoading}<p>Loading...</p>{/if}
 * {#if $error}<p>Error: {$error.message}</p>{/if}
 * {#each $agents as agent}
 *   <li>{agent.name} <button on:click={() => agentStore.remove(agent.id)}>Delete</button></li>
 * {/each}
 * ```
 */
export function createAgent(options: AgentOptions = {}) {
  const initialState: AgentState = {
    agents: [],
    isLoading: true,
    error: null,
  };

  const store = writable<AgentState>(initialState);
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

  // ─── list ───────────────────────────────────────────────────────────

  async function list(): Promise<AgentRegistration[]> {
    return request<AgentRegistration[]>('GET', '/auth/agents');
  }

  // ─── Auto-load on init ──────────────────────────────────────────────

  async function fetchAgents(): Promise<void> {
    update(s => ({ ...s, isLoading: true, error: null }));

    try {
      const data = await list();
      update(s => ({ ...s, agents: data, isLoading: false }));
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        isLoading: false,
        error: { message: e.message || 'Failed to fetch agents', status: e.status, code: e.code },
      }));
    }
  }

  // Kick off initial load
  fetchAgents();

  // ─── create ─────────────────────────────────────────────────────────

  async function create(agentConfig: CreateAgentRequest): Promise<AgentRegistration | null> {
    try {
      const data = await request<AgentRegistration>('POST', '/auth/agents/register', agentConfig);
      update(s => ({ ...s, agents: [...s.agents, data] }));
      return data;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to create agent', status: e.status, code: e.code },
      }));
      return null;
    }
  }

  // ─── get ────────────────────────────────────────────────────────────

  async function getAgent(id: string): Promise<AgentRegistration | null> {
    try {
      return await request<AgentRegistration>('GET', `/auth/agents/${id}`);
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to get agent', status: e.status, code: e.code },
      }));
      return null;
    }
  }

  // ─── remove ─────────────────────────────────────────────────────────

  async function remove(id: string): Promise<boolean> {
    try {
      await request<void>('DELETE', `/auth/agents/${id}`);
      update(s => ({ ...s, agents: s.agents.filter(a => a.id !== id) }));
      return true;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to delete agent', status: e.status, code: e.code },
      }));
      return false;
    }
  }

  return {
    subscribe,
    agents: derived(store, $s => $s.agents),
    isLoading: derived(store, $s => $s.isLoading),
    error: derived(store, $s => $s.error),
    create,
    get: getAgent,
    list,
    remove,
    refetch: fetchAgents,
  };
}
