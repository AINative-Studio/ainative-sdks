/**
 * useTask Composable
 *
 * Provides swarm task submission, polling, and listing via the AINative Swarm API.
 * Wraps the /agent-swarm/tasks endpoints.
 *
 * Refs ainative-website#1104
 */

import { ref, onUnmounted, type Ref } from 'vue';
import { useAINative } from './useAINative';
import type { AINativeError } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface UseTaskOptions {
  /** Polling interval in milliseconds when a task is active. Defaults to 2000. */
  pollInterval?: number;
  baseUrl?: string;
  apiKey?: string;
}

export interface UseTaskReturn {
  tasks: Ref<SwarmTask[]>;
  status: Ref<SwarmTaskStatus | null>;
  result: Ref<Record<string, unknown> | null>;
  isLoading: Ref<boolean>;
  error: Ref<AINativeError | null>;
  submit: (
    description: string,
    agentTypes?: string[],
    config?: Record<string, unknown>
  ) => Promise<SwarmTask | null>;
  poll: (taskId: string) => Promise<SwarmTask | null>;
  cancel: (taskId: string) => Promise<boolean>;
  listTasks: (opts?: { status?: string; limit?: number; offset?: number }) => Promise<SwarmTask[]>;
}

const TERMINAL_STATUSES: SwarmTaskStatus[] = ['completed', 'failed', 'cancelled'];
const DEFAULT_POLL_INTERVAL = 2000;

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Composable for submitting and tracking swarm tasks.
 *
 * Automatically polls the active task until it reaches a terminal state.
 * Cleans up poll timers on component unmount.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useTask } from '@ainative/vue-sdk';
 *
 * const { submit, status, result, isLoading, error } = useTask({ pollInterval: 3000 });
 *
 * async function run() {
 *   await submit('Analyse Q1 report', ['analyst', 'summarizer']);
 * }
 * </script>
 *
 * <template>
 *   <button @click="run" :disabled="isLoading">Run Task</button>
 *   <p v-if="status">Status: {{ status }}</p>
 *   <pre v-if="result">{{ JSON.stringify(result, null, 2) }}</pre>
 *   <p v-if="error">Error: {{ error.message }}</p>
 * </template>
 * ```
 */
export function useTask(options: UseTaskOptions = {}): UseTaskReturn {
  const config = useAINative();
  const baseUrl = options.baseUrl || config.baseUrl || 'https://api.ainative.studio';
  const apiKey = options.apiKey || config.apiKey;
  const pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL;

  const tasks = ref<SwarmTask[]>([]);
  const status = ref<SwarmTaskStatus | null>(null);
  const result = ref<Record<string, unknown> | null>(null);
  const isLoading = ref(false);
  const error = ref<AINativeError | null>(null);

  let activeTaskId: string | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  onUnmounted(() => {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  });

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

  // ─── poll ───────────────────────────────────────────────────────────

  async function poll(taskId: string): Promise<SwarmTask | null> {
    try {
      const task = await request<SwarmTask>('GET', `/agent-swarm/tasks/${taskId}`);
      status.value = task.status;
      result.value = task.result;

      const idx = tasks.value.findIndex(t => t.task_id === taskId);
      if (idx === -1) {
        tasks.value = [...tasks.value, task];
      } else {
        tasks.value = tasks.value.map((t, i) => (i === idx ? task : t));
      }

      return task;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to poll task',
        status: e.status,
        code: e.code,
      };
      return null;
    }
  }

  // ─── Internal auto-poll loop ────────────────────────────────────────

  function startPolling(taskId: string): void {
    activeTaskId = taskId;

    const tick = async () => {
      if (activeTaskId !== taskId) return;

      const task = await poll(taskId);
      if (!task) {
        isLoading.value = false;
        return;
      }

      if (TERMINAL_STATUSES.includes(task.status)) {
        isLoading.value = false;
        activeTaskId = null;
        return;
      }

      pollTimer = setTimeout(tick, pollInterval);
    };

    tick();
  }

  // ─── submit ─────────────────────────────────────────────────────────

  async function submit(
    description: string,
    agentTypes?: string[],
    taskConfig?: Record<string, unknown>
  ): Promise<SwarmTask | null> {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    activeTaskId = null;

    isLoading.value = true;
    error.value = null;
    status.value = null;
    result.value = null;

    try {
      const task = await request<SwarmTask>('POST', '/agent-swarm/tasks', {
        description,
        ...(agentTypes && { agent_types: agentTypes }),
        ...(taskConfig && { config: taskConfig }),
      });

      status.value = task.status;
      tasks.value = [task, ...tasks.value];

      if (!TERMINAL_STATUSES.includes(task.status)) {
        startPolling(task.task_id);
      } else {
        result.value = task.result;
        isLoading.value = false;
      }

      return task;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to submit task',
        status: e.status,
        code: e.code,
      };
      isLoading.value = false;
      return null;
    }
  }

  // ─── cancel ─────────────────────────────────────────────────────────

  async function cancel(taskId: string): Promise<boolean> {
    try {
      await request<void>('DELETE', `/agent-swarm/tasks/${taskId}`);

      if (activeTaskId === taskId) {
        if (pollTimer !== null) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
        activeTaskId = null;
        isLoading.value = false;
        status.value = 'cancelled';
      }

      tasks.value = tasks.value.map(t =>
        t.task_id === taskId ? { ...t, status: 'cancelled' as SwarmTaskStatus } : t
      );

      return true;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to cancel task',
        status: e.status,
        code: e.code,
      };
      return false;
    }
  }

  // ─── listTasks ──────────────────────────────────────────────────────

  async function listTasks(opts?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<SwarmTask[]> {
    const params: Record<string, string> = {};
    if (opts?.status) params.status = opts.status;
    if (opts?.limit !== undefined) params.limit = String(opts.limit);
    if (opts?.offset !== undefined) params.offset = String(opts.offset);

    try {
      const data = await request<{ tasks: SwarmTask[]; total: number }>(
        'GET',
        '/agent-swarm/tasks',
        undefined,
        params
      );
      tasks.value = data.tasks;
      return data.tasks;
    } catch (err) {
      const e = err as AINativeError;
      error.value = {
        message: e.message || 'Failed to list tasks',
        status: e.status,
        code: e.code,
      };
      return [];
    }
  }

  return {
    tasks,
    status,
    result,
    isLoading,
    error,
    submit,
    poll,
    cancel,
    listTasks,
  };
}
