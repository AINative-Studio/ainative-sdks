/**
 * Server-side Agent Client for Next.js
 *
 * Provides plain async functions (not hooks) for use in Server Components,
 * Server Actions, and API routes.
 *
 * Refs ainative-website#1105
 */

// ─── Types (re-used from the React SDK shape) ─────────────────────────────────

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

export type SwarmTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SwarmTask {
  task_id: string;
  status: SwarmTaskStatus;
  description: string;
  agent_types: string[];
  config: Record<string, unknown>;
  result: Record<string, unknown> | null;
  agents_used: string[];
  created_at: string;
  updated_at: string;
}

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

export interface AgentServerClientConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface AgentServerClient {
  agent: {
    list: () => Promise<AgentRegistration[]>;
    get: (id: string) => Promise<AgentRegistration>;
    create: (config: CreateAgentRequest) => Promise<AgentRegistration>;
    remove: (id: string) => Promise<void>;
  };
  task: {
    submit: (
      description: string,
      agentTypes?: string[],
      config?: Record<string, unknown>
    ) => Promise<SwarmTask>;
    get: (taskId: string) => Promise<SwarmTask>;
    cancel: (taskId: string) => Promise<void>;
    list: (opts?: {
      status?: string;
      limit?: number;
      offset?: number;
    }) => Promise<{ tasks: SwarmTask[]; total: number }>;
  };
  memory: {
    remember: (
      content: string,
      options?: {
        entity_id?: string;
        memory_type?: string;
        importance?: number;
        tags?: string[];
        metadata?: Record<string, unknown>;
      }
    ) => Promise<Memory>;
    recall: (
      query: string,
      options?: { entity_id?: string; layer?: string; limit?: number }
    ) => Promise<Memory[]>;
    forget: (memoryId: string) => Promise<void>;
  };
  thread: {
    list: (opts?: { limit?: number; status?: string; search?: string }) => Promise<Thread[]>;
    get: (threadId: string) => Promise<ThreadWithMessages>;
    create: (title?: string, agentTypes?: string[]) => Promise<Thread>;
    appendMessage: (
      threadId: string,
      message: { role: string; content: string }
    ) => Promise<ThreadMessage>;
    fork: (threadId: string, fromMessageId: string, title?: string) => Promise<Thread>;
    remove: (threadId: string) => Promise<void>;
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a server-side agent client.
 *
 * Falls back to the `AINATIVE_API_KEY` environment variable when `apiKey` is
 * not provided explicitly.
 *
 * @example
 * ```tsx
 * // app/agents/page.tsx
 * import { createAgentServerClient } from '@ainative/next-sdk/server';
 *
 * export default async function AgentsPage() {
 *   const client = createAgentServerClient();
 *   const agents = await client.agent.list();
 *   return <ul>{agents.map(a => <li key={a.id}>{a.name}</li>)}</ul>;
 * }
 * ```
 */
export function createAgentServerClient(config: AgentServerClientConfig = {}): AgentServerClient {
  const apiKey =
    config.apiKey || (typeof process !== 'undefined' ? process.env.AINATIVE_API_KEY : undefined);

  if (!apiKey) {
    throw new Error(
      'AINative API key is required. Pass apiKey in config or set the AINATIVE_API_KEY environment variable.'
    );
  }

  const baseUrl = config.baseUrl || 'https://api.ainative.studio/api/v1';

  // ─── Internal fetch helper ────────────────────────────────────────

  async function fetchAPI<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
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
      const errorData = await response.json().catch(() => ({})) as { detail?: string };
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    if (response.status === 204) return null as T;
    return response.json() as Promise<T>;
  }

  return {
    // ─── agent ─────────────────────────────────────────────────────

    agent: {
      list: () => fetchAPI<AgentRegistration[]>('GET', '/auth/agents'),

      get: (id: string) => fetchAPI<AgentRegistration>('GET', `/auth/agents/${id}`),

      create: (agentConfig: CreateAgentRequest) =>
        fetchAPI<AgentRegistration>('POST', '/auth/agents/register', agentConfig),

      remove: (id: string) => fetchAPI<void>('DELETE', `/auth/agents/${id}`),
    },

    // ─── task ──────────────────────────────────────────────────────

    task: {
      submit: (
        description: string,
        agentTypes?: string[],
        taskConfig?: Record<string, unknown>
      ) =>
        fetchAPI<SwarmTask>('POST', '/agent-swarm/tasks', {
          description,
          ...(agentTypes && { agent_types: agentTypes }),
          ...(taskConfig && { config: taskConfig }),
        }),

      get: (taskId: string) => fetchAPI<SwarmTask>('GET', `/agent-swarm/tasks/${taskId}`),

      cancel: (taskId: string) => fetchAPI<void>('DELETE', `/agent-swarm/tasks/${taskId}`),

      list: (opts?: { status?: string; limit?: number; offset?: number }) => {
        const params: Record<string, string> = {};
        if (opts?.status) params.status = opts.status;
        if (opts?.limit !== undefined) params.limit = String(opts.limit);
        if (opts?.offset !== undefined) params.offset = String(opts.offset);
        return fetchAPI<{ tasks: SwarmTask[]; total: number }>(
          'GET',
          '/agent-swarm/tasks',
          undefined,
          params
        );
      },
    },

    // ─── memory ────────────────────────────────────────────────────

    memory: {
      remember: (
        content: string,
        opts?: {
          entity_id?: string;
          memory_type?: string;
          importance?: number;
          tags?: string[];
          metadata?: Record<string, unknown>;
        }
      ) =>
        fetchAPI<Memory>('POST', '/public/memory/v2/remember', {
          content,
          ...opts,
        }),

      recall: (
        query: string,
        opts?: { entity_id?: string; layer?: string; limit?: number }
      ) =>
        fetchAPI<Memory[]>('POST', '/public/memory/v2/recall', {
          query,
          ...opts,
        }),

      forget: (memoryId: string) =>
        fetchAPI<void>('DELETE', `/public/memory/v2/forget/${memoryId}`),
    },

    // ─── thread ────────────────────────────────────────────────────

    thread: {
      list: (opts?: { limit?: number; status?: string; search?: string }) => {
        const params: Record<string, string> = {};
        if (opts?.limit !== undefined) params.limit = String(opts.limit);
        if (opts?.status) params.status = opts.status;
        if (opts?.search) params.search = opts.search;
        return fetchAPI<Thread[]>('GET', '/threads', undefined, params);
      },

      get: (threadId: string) =>
        fetchAPI<ThreadWithMessages>('GET', `/threads/${threadId}`),

      create: (title?: string, agentTypes?: string[]) => {
        const body: { title?: string; agent_types?: string[] } = {};
        if (title) body.title = title;
        if (agentTypes) body.agent_types = agentTypes;
        return fetchAPI<Thread>('POST', '/threads', body);
      },

      appendMessage: (
        threadId: string,
        message: { role: string; content: string }
      ) => fetchAPI<ThreadMessage>('POST', `/threads/${threadId}/messages`, message),

      fork: (threadId: string, fromMessageId: string, title?: string) =>
        fetchAPI<Thread>('POST', `/threads/${threadId}/fork`, {
          message_id: fromMessageId,
          ...(title && { title }),
        }),

      remove: (threadId: string) => fetchAPI<void>('DELETE', `/threads/${threadId}`),
    },
  };
}
