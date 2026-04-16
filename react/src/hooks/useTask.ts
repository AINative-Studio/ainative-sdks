/**
 * useTask Hook
 *
 * Provides swarm task submission, polling, and listing via the AINative Swarm API.
 * Wraps the /agent-swarm/tasks endpoints.
 *
 * Refs ainative-website#1102
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAINativeContext } from '../AINativeProvider';
import { AINativeError } from '../types';

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

export interface SubmitTaskRequest {
  description: string;
  agent_types?: string[];
  config?: Record<string, unknown>;
}

export interface UseTaskOptions {
  /** Polling interval in milliseconds when a task is active. Defaults to 2000. */
  pollInterval?: number;
}

export interface UseTaskReturn {
  tasks: SwarmTask[];
  status: SwarmTaskStatus | null;
  result: Record<string, unknown> | null;
  error: AINativeError | null;
  isLoading: boolean;
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

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook for submitting and tracking swarm tasks.
 *
 * Automatically polls the active task until it reaches a terminal state.
 *
 * @example
 * ```tsx
 * function TaskRunner() {
 *   const { submit, status, result, error, isLoading } = useTask({ pollInterval: 3000 });
 *
 *   const handleRun = async () => {
 *     await submit('Analyse the Q1 report', ['analyst', 'summarizer']);
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleRun} disabled={isLoading}>Run Task</button>
 *       {status && <p>Status: {status}</p>}
 *       {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTask(options: UseTaskOptions = {}): UseTaskReturn {
  const { config, baseUrl } = useAINativeContext();
  const pollInterval = options.pollInterval ?? DEFAULT_POLL_INTERVAL;

  const [tasks, setTasks] = useState<SwarmTask[]>([]);
  const [status, setStatus] = useState<SwarmTaskStatus | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<AINativeError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Track the currently-polling task id so we can stop when unmounting
  const activeTaskIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  // ─── Shared request helper ──────────────────────────────────────────

  const request = useCallback(
    async <T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> => {
      const url = new URL(`${baseUrl}${path}`);
      if (params) {
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      }

      const response = await fetch(url.toString(), {
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

  // ─── poll ───────────────────────────────────────────────────────────

  const poll = useCallback(
    async (taskId: string): Promise<SwarmTask | null> => {
      try {
        const task = await request<SwarmTask>('GET', `/agent-swarm/tasks/${taskId}`);
        setStatus(task.status);
        setResult(task.result);

        // Keep tasks list in sync
        setTasks((prev) => {
          const idx = prev.findIndex((t) => t.task_id === taskId);
          if (idx === -1) return [...prev, task];
          const updated = [...prev];
          updated[idx] = task;
          return updated;
        });

        return task;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to poll task',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return null;
      }
    },
    [request]
  );

  // ─── Internal auto-poll loop ────────────────────────────────────────

  const startPolling = useCallback(
    (taskId: string) => {
      activeTaskIdRef.current = taskId;

      const tick = async () => {
        if (activeTaskIdRef.current !== taskId) return;

        const task = await poll(taskId);
        if (!task) {
          setIsLoading(false);
          return;
        }

        if (TERMINAL_STATUSES.includes(task.status)) {
          setIsLoading(false);
          activeTaskIdRef.current = null;
          return;
        }

        pollTimerRef.current = setTimeout(tick, pollInterval);
      };

      tick();
    },
    [poll, pollInterval]
  );

  // ─── submit ─────────────────────────────────────────────────────────

  const submit = useCallback(
    async (
      description: string,
      agentTypes?: string[],
      taskConfig?: Record<string, unknown>
    ): Promise<SwarmTask | null> => {
      // Cancel any ongoing poll
      if (pollTimerRef.current !== null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      activeTaskIdRef.current = null;

      setIsLoading(true);
      setError(null);
      setStatus(null);
      setResult(null);

      try {
        const task = await request<SwarmTask>('POST', '/agent-swarm/tasks', {
          description,
          ...(agentTypes && { agent_types: agentTypes }),
          ...(taskConfig && { config: taskConfig }),
        });

        setStatus(task.status);
        setTasks((prev) => [task, ...prev]);

        // Begin polling if task is not already terminal
        if (!TERMINAL_STATUSES.includes(task.status)) {
          startPolling(task.task_id);
        } else {
          setResult(task.result);
          setIsLoading(false);
        }

        return task;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to submit task',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        setIsLoading(false);
        return null;
      }
    },
    [request, startPolling]
  );

  // ─── cancel ─────────────────────────────────────────────────────────

  const cancel = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        await request<void>('DELETE', `/agent-swarm/tasks/${taskId}`);

        // Stop polling if this is the active task
        if (activeTaskIdRef.current === taskId) {
          if (pollTimerRef.current !== null) {
            clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          activeTaskIdRef.current = null;
          setIsLoading(false);
          setStatus('cancelled');
        }

        setTasks((prev) =>
          prev.map((t) =>
            t.task_id === taskId ? { ...t, status: 'cancelled' as SwarmTaskStatus } : t
          )
        );

        return true;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to cancel task',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return false;
      }
    },
    [request]
  );

  // ─── listTasks ──────────────────────────────────────────────────────

  const listTasks = useCallback(
    async (opts?: {
      status?: string;
      limit?: number;
      offset?: number;
    }): Promise<SwarmTask[]> => {
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
        setTasks(data.tasks);
        return data.tasks;
      } catch (err) {
        const e = err as AINativeError;
        const errorObj: AINativeError = {
          message: e.message || 'Failed to list tasks',
          status: e.status,
          code: e.code,
        };
        setError(errorObj);
        return [];
      }
    },
    [request]
  );

  return {
    tasks,
    status,
    result,
    error,
    isLoading,
    submit,
    poll,
    cancel,
    listTasks,
  };
}
