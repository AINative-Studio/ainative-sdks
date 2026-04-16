/**
 * Tests for createTask store
 *
 * Refs ainative-website#1103
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { setAINativeConfig } from '../stores/config';
import { createTask } from '../stores/task';
import type { SwarmTask } from '../stores/task';

// Mock fetch globally
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

describe('createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    setAINativeConfig({ apiKey: 'test-key', baseUrl: 'https://api.test.com' });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ─── Initial state ──────────────────────────────────────────────────

  it('should initialise with empty state', () => {
    const store = createTask();
    expect(get(store.tasks)).toEqual([]);
    expect(get(store.status)).toBeNull();
    expect(get(store.result)).toBeNull();
    expect(get(store.isLoading)).toBe(false);
    expect(get(store.error)).toBeNull();
  });

  // ─── submit ─────────────────────────────────────────────────────────

  it('should submit a task and begin polling until completion', async () => {
    const running = mockTask({ status: 'running' });
    const completed = mockTask({ status: 'completed', result: { summary: 'done' } });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => running })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => completed });

    const store = createTask({ pollInterval: 100 });

    await store.submit('Analyse sales data', ['analyst']);

    // Advance timer to trigger poll tick
    await vi.advanceTimersByTimeAsync(200);

    expect(get(store.status)).toBe('completed');
    expect(get(store.isLoading)).toBe(false);
    expect(get(store.result)).toEqual({ summary: 'done' });
    expect(get(store.tasks)).toHaveLength(1);
  });

  it('should resolve immediately if task is already completed on submit', async () => {
    const completed = mockTask({ status: 'completed', result: { x: 1 } });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => completed,
    });

    const store = createTask();
    await store.submit('Quick task');

    expect(get(store.isLoading)).toBe(false);
    expect(get(store.status)).toBe('completed');
    expect(get(store.result)).toEqual({ x: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should POST to /agent-swarm/tasks with correct body', async () => {
    const completed = mockTask({ status: 'completed' });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => completed,
    });

    const store = createTask();
    await store.submit('My task', ['worker'], { priority: 'high' });

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

    const store = createTask();
    const result = await store.submit('Failing task');

    expect(result).toBeNull();
    expect(get(store.isLoading)).toBe(false);
    expect(get(store.error)).toMatchObject({ message: 'Swarm offline', status: 503 });
  });

  // ─── poll ───────────────────────────────────────────────────────────

  it('should poll a task by id and update state', async () => {
    const task = mockTask({ status: 'running' });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => task,
    });

    const store = createTask();
    const polled = await store.poll('task-1');

    expect(polled).toEqual(task);
    expect(get(store.status)).toBe('running');
    expect(get(store.tasks)).toHaveLength(1);
  });

  it('should set error and return null when poll fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const store = createTask();
    const result = await store.poll('task-x');

    expect(result).toBeNull();
    expect(get(store.error)).toMatchObject({ message: 'Network error' });
  });

  // ─── cancel ─────────────────────────────────────────────────────────

  it('should cancel a task and update status in list', async () => {
    const completed = mockTask({ status: 'completed' });

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => completed })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const store = createTask();
    await store.submit('Task to cancel');

    const success = await store.cancel('task-1');

    expect(success).toBe(true);
    expect(get(store.tasks)[0].status).toBe('cancelled');
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

    const store = createTask();
    await store.submit('Task');

    const success = await store.cancel('bad-id');
    expect(success).toBe(false);
    expect(get(store.error)).toMatchObject({ message: 'Task not found', status: 404 });
  });

  // ─── listTasks ──────────────────────────────────────────────────────

  it('should list tasks and update store', async () => {
    const taskList = [mockTask(), mockTask({ task_id: 'task-2', status: 'completed' })];

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tasks: taskList, total: 2 }),
    });

    const store = createTask();
    const tasks = await store.listTasks();

    expect(tasks).toHaveLength(2);
    expect(get(store.tasks)).toHaveLength(2);
  });

  it('should append query params when listing tasks', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ tasks: [], total: 0 }),
    });

    const store = createTask();
    await store.listTasks({ status: 'running', limit: 10, offset: 20 });

    const url: string = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toContain('status=running');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
  });

  it('should set error and return empty array when listTasks fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('List failed'));

    const store = createTask();
    const tasks = await store.listTasks();

    expect(tasks).toEqual([]);
    expect(get(store.error)).toMatchObject({ message: 'List failed' });
  });

  // ─── destroy ────────────────────────────────────────────────────────

  it('should clean up poll timer when destroy() is called', async () => {
    const running = mockTask({ status: 'running' });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => running,
    });

    const store = createTask({ pollInterval: 5000 });
    await store.submit('Long running task');

    // Should not throw
    expect(() => store.destroy()).not.toThrow();
  });
});
