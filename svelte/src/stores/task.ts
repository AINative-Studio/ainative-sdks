/**
 * createTask Store
 *
 * Provides swarm task submission, polling, and listing via the AINative Swarm API.
 * Wraps the /agent-swarm/tasks endpoints.
 *
 * Refs ainative-website#1103
 */

import { writable, derived, get } from 'svelte/store';
import { ainativeConfig } from './config';
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

export interface TaskOptions {
  /** Polling interval in milliseconds when a task is active. Defaults to 2000. */
  pollInterval?: number;
  baseUrl?: string;
  apiKey?: string;
}

export interface TaskState {
  tasks: SwarmTask[];
  status: SwarmTaskStatus | null;
  result: Record<string, unknown> | null;
  isLoading: boolean;
  error: AINativeError | null;
}

const TERMINAL_STATUSES: SwarmTaskStatus[] = ['completed', 'failed', 'cancelled'];
const DEFAULT_POLL_INTERVAL = 2000;

// ─── Store factory ────────────────────────────────────────────────────────────

/**
 * Creates a Svelte store for submitting and tracking swarm tasks.
 *
 * Automatically polls the active task until it reaches a terminal state.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createTask } from '@ainative/svelte-sdk';
 *
 *   const taskStore = createTask({ pollInterval: 3000 });
 *   const { tasks, status, result, isLoading, error } = taskStore;
 *
 *   async function run() {
 *     await taskStore.submit('Analyse the Q1 report', ['analyst', 'summarizer']);
 *   }
 * </script>
 *
 * <button on:click={run} disabled={$isLoading}>Run Task</button>
 * {#if $status}<p>Status: {$status}</p>{/if}
 * {#if $result}<pre>{JSON.stringify($result, null, 2)}</pre>{/if}
 * ```
 */
export function createTask(options: TaskOptions = {}) {
  const pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL;

  const initialState: TaskState = {
    tasks: [],
    status: null,
    result: null,
    isLoading: false,
    error: null,
  };

  const store = writable<TaskState>(initialState);
  const { subscribe, update, set } = store;

  let activeTaskId: string | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

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

  // ─── poll ───────────────────────────────────────────────────────────

  async function poll(taskId: string): Promise<SwarmTask | null> {
    try {
      const task = await request<SwarmTask>('GET', `/agent-swarm/tasks/${taskId}`);
      update(s => {
        const idx = s.tasks.findIndex(t => t.task_id === taskId);
        const updatedTasks =
          idx === -1
            ? [...s.tasks, task]
            : s.tasks.map((t, i) => (i === idx ? task : t));
        return { ...s, tasks: updatedTasks, status: task.status, result: task.result };
      });
      return task;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to poll task', status: e.status, code: e.code },
      }));
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
        update(s => ({ ...s, isLoading: false }));
        return;
      }

      if (TERMINAL_STATUSES.includes(task.status)) {
        update(s => ({ ...s, isLoading: false }));
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

    update(s => ({ ...s, isLoading: true, error: null, status: null, result: null }));

    try {
      const task = await request<SwarmTask>('POST', '/agent-swarm/tasks', {
        description,
        ...(agentTypes && { agent_types: agentTypes }),
        ...(taskConfig && { config: taskConfig }),
      });

      update(s => ({ ...s, status: task.status, tasks: [task, ...s.tasks] }));

      if (!TERMINAL_STATUSES.includes(task.status)) {
        startPolling(task.task_id);
      } else {
        update(s => ({ ...s, result: task.result, isLoading: false }));
      }

      return task;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        isLoading: false,
        error: { message: e.message || 'Failed to submit task', status: e.status, code: e.code },
      }));
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
        update(s => ({ ...s, isLoading: false, status: 'cancelled' }));
      }

      update(s => ({
        ...s,
        tasks: s.tasks.map(t =>
          t.task_id === taskId ? { ...t, status: 'cancelled' as SwarmTaskStatus } : t
        ),
      }));

      return true;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to cancel task', status: e.status, code: e.code },
      }));
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
      update(s => ({ ...s, tasks: data.tasks }));
      return data.tasks;
    } catch (err) {
      const e = err as AINativeError;
      update(s => ({
        ...s,
        error: { message: e.message || 'Failed to list tasks', status: e.status, code: e.code },
      }));
      return [];
    }
  }

  // ─── destroy (cleanup) ───────────────────────────────────────────────

  function destroy(): void {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    activeTaskId = null;
  }

  return {
    subscribe,
    tasks: derived(store, $s => $s.tasks),
    status: derived(store, $s => $s.status),
    result: derived(store, $s => $s.result),
    isLoading: derived(store, $s => $s.isLoading),
    error: derived(store, $s => $s.error),
    submit,
    poll,
    cancel,
    listTasks,
    destroy,
  };
}
