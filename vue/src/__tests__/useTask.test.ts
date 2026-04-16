/**
 * Tests for useTask composable
 *
 * Refs ainative-website#1104
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp } from 'vue';
import { AINativeConfigKey } from '../composables/useAINative';
import { useTask } from '../composables/useTask';
import type { SwarmTask } from '../composables/useTask';

global.fetch = vi.fn();

vi.useFakeTimers();

function mockTask(overrides: Partial<SwarmTask> = {}): SwarmTask {
  return {
    task_id: 'task-1',
    status: 'queued',
    description: 'Analyse sales data',
    agent_types: ['analyst'],
    config: {},
    result: null,
    agents_used: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function withApp<T>(fn: () => T): { result: T; app: ReturnType<typeof createApp> } {
  let result!: T;
  const app = createApp({ setup() { result = fn(); return {}; }, template: '<div/>' });
  app.provide(AINativeConfigKey, { apiKey: 'test-key', baseUrl: 'https://api.test.com' });
  const mountPoint = document.createElement('div');
  app.mount(mountPoint);
  return { result, app };
}

describe('useTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ─── Initial state ──────────────────────────────────────────────────

  it('should initialise with empty state', () => {
    const { result } = withApp(() => useTask());
    expect(result.tasks.value).toEqual([]);
    expect(result.status.value).toBeNull();
    expect(result.result.value).toBeNull();
    expect(result.isLoading.value).toBe(false);
    expect(result.error.value).toBeNull();
  });

  // ─── submit ─────────────────────────────────────────────────────────

  it('should submit a task and poll until completion', async () => {
    const running = mockTask({ status: 'running' });
    const completed = mockTask({ status: 'completed', result: { summary: 'done' } });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => running })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => completed });

    const { result } = withApp(() => useTask({ pollInterval: 100 }));
    await result.submit('Analyse sales data', ['analyst']);

    await vi.advanceTimersByTimeAsync(200);

    expect(result.status.value).toBe('completed');
    expect(result.isLoading.value).toBe(false);
    expect(result.result.value).toEqual({ summary: 'done' });
  });

  it('should resolve immediately when submitted task is already terminal', async () => {
    const completed = mockTask({ status: 'completed', result: { x: 1 } });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => completed,
    });

    const { result } = withApp(() => useTask());
    await result.submit('Quick task');

    expect(result.isLoading.value).toBe(false);
    expect(result.status.value).toBe('completed');
    expect(result.result.value).toEqual({ x: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should POST to /agent-swarm/tasks with correct body', async () => {
    const completed = mockTask({ status: 'completed' });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => completed,
    });

    const { result } = withApp(() => useTask());
    await result.submit('My task', ['worker'], { priority: 'high' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/agent-swarm/tasks'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      })
    );

    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.description).toBe('My task');
    expect(body.agent_types).toEqual(['worker']);
    expect(body.config).toEqual({ priority: 'high' });
  });

  it('should set error and return null when submit fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ detail: 'Swarm offline' }),
    });

    const { result } = withApp(() => useTask());
    const task = await result.submit('Failing task');

    expect(task).toBeNull();
    expect(result.isLoading.value).toBe(false);
    expect(result.error.value).toMatchObject({ message: 'Swarm offline', status: 503 });
  });

  // ─── poll ───────────────────────────────────────────────────────────

  it('should poll a task by id and update state', async () => {
    const task = mockTask({ status: 'running' });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => task,
    });

    const { result } = withApp(() => useTask());
    const polled = await result.poll('task-1');

    expect(polled).toEqual(task);
    expect(result.status.value).toBe('running');
    expect(result.tasks.value).toHaveLength(1);
  });

  it('should set error and return null when poll fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const { result } = withApp(() => useTask());
    const polled = await result.poll('task-x');

    expect(polled).toBeNull();
    expect(result.error.value).toMatchObject({ message: 'Network error' });
  });

  // ─── cancel ─────────────────────────────────────────────────────────

  it('should cancel a task and update status in list', async () => {
    const completed = mockTask({ status: 'completed' });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => completed })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const { result } = withApp(() => useTask());
    await result.submit('Task');

    const success = await result.cancel('task-1');
    expect(success).toBe(true);
    expect(result.tasks.value[0].status).toBe('cancelled');
  });

  it('should set error and return false when cancel fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTask({ status: 'completed' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Task not found' }),
      });

    const { result } = withApp(() => useTask());
    await result.submit('Task');

    const success = await result.cancel('bad-id');
    expect(success).toBe(false);
    expect(result.error.value).toMatchObject({ message: 'Task not found', status: 404 });
  });

  // ─── listTasks ──────────────────────────────────────────────────────

  it('should list tasks and update state', async () => {
    const taskList = [mockTask(), mockTask({ task_id: 'task-2', status: 'completed' })];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tasks: taskList, total: 2 }),
    });

    const { result } = withApp(() => useTask());
    const tasks = await result.listTasks();

    expect(tasks).toHaveLength(2);
    expect(result.tasks.value).toHaveLength(2);
  });

  it('should pass query params when listing tasks', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tasks: [], total: 0 }),
    });

    const { result } = withApp(() => useTask());
    await result.listTasks({ status: 'running', limit: 10, offset: 20 });

    const url: string = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toContain('status=running');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
  });

  it('should set error and return empty array when listTasks fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('List failed'));

    const { result } = withApp(() => useTask());
    const tasks = await result.listTasks();

    expect(tasks).toEqual([]);
    expect(result.error.value).toMatchObject({ message: 'List failed' });
  });

  // ─── unmount cleanup ────────────────────────────────────────────────

  it('should clean up poll timer on component unmount', async () => {
    const running = mockTask({ status: 'running' });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => running,
    });

    const { result, app } = withApp(() => useTask({ pollInterval: 5000 }));
    await result.submit('Long running task');

    // Unmounting should not throw
    expect(() => app.unmount()).not.toThrow();
  });
});
