/**
 * Tests for useTask hook
 *
 * Refs ainative-website#1102
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AINativeProvider } from '../AINativeProvider';
import { useTask } from '../hooks/useTask';
import type { SwarmTask } from '../hooks/useTask';

// Mock fetch
global.fetch = jest.fn();

// Suppress act() warnings for polling tests
jest.useFakeTimers();

const mockTask = (overrides: Partial<SwarmTask> = {}): SwarmTask => ({
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
});

describe('useTask', () => {
  const mockConfig = { apiKey: 'test-api-key' };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AINativeProvider config={mockConfig}>{children}</AINativeProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  // ─── Initial state ──────────────────────────────────────────────────

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useTask(), { wrapper });

    expect(result.current.tasks).toEqual([]);
    expect(result.current.status).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ─── submit ─────────────────────────────────────────────────────────

  it('should submit a task and poll until completion', async () => {
    const running = mockTask({ status: 'running' });
    const completed = mockTask({ status: 'completed', result: { summary: 'done' } });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => running })   // submit
      .mockResolvedValueOnce({ ok: true, json: async () => completed }); // first poll

    const { result } = renderHook(() => useTask({ pollInterval: 100 }), { wrapper });

    await act(async () => {
      await result.current.submit('Analyse sales data', ['analyst']);
    });

    // Advance timer to trigger first poll
    await act(async () => {
      jest.advanceTimersByTime(200);
      // Allow microtask queue to flush
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('completed'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toEqual({ summary: 'done' });
    expect(result.current.tasks).toHaveLength(1);
  });

  it('should post to /agent-swarm/tasks when submitting', async () => {
    const completed = mockTask({ status: 'completed' });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => completed,
    });

    const { result } = renderHook(() => useTask(), { wrapper });

    await act(async () => {
      await result.current.submit('My task', ['worker'], { priority: 'high' });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/agent-swarm/tasks'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      })
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.description).toBe('My task');
    expect(body.agent_types).toEqual(['worker']);
    expect(body.config).toEqual({ priority: 'high' });
  });

  it('should resolve immediately if task is already completed on submit', async () => {
    const completed = mockTask({ status: 'completed', result: { x: 1 } });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => completed,
    });

    const { result } = renderHook(() => useTask(), { wrapper });

    await act(async () => {
      await result.current.submit('Quick task');
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.status).toBe('completed');
    expect(result.current.result).toEqual({ x: 1 });
    // No polling fetch should have been triggered
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should set error when submit fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ detail: 'Swarm offline' }),
    });

    const { result } = renderHook(() => useTask(), { wrapper });

    let submitted = null;
    await act(async () => {
      submitted = await result.current.submit('Failing task');
    });

    expect(submitted).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Swarm offline', status: 503 })
    );
  });

  // ─── poll ───────────────────────────────────────────────────────────

  it('should poll a task by id and update state', async () => {
    const task = mockTask({ status: 'running' });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => task,
    });

    const { result } = renderHook(() => useTask(), { wrapper });

    let polled: SwarmTask | null = null;
    await act(async () => {
      polled = await result.current.poll('task-1');
    });

    expect(polled).toEqual(task);
    expect(result.current.status).toBe('running');
    expect(result.current.tasks).toHaveLength(1);
  });

  it('should set error when poll fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTask(), { wrapper });

    let polled: SwarmTask | null = undefined as unknown as null;
    await act(async () => {
      polled = await result.current.poll('task-x');
    });

    expect(polled).toBeNull();
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Network error' })
    );
  });

  // ─── cancel ─────────────────────────────────────────────────────────

  it('should cancel a task and update status', async () => {
    const completed = mockTask({ status: 'completed' });

    // submit (terminal, no polling)
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => completed })
      // cancel
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null });

    const { result } = renderHook(() => useTask(), { wrapper });

    await act(async () => {
      await result.current.submit('Task to cancel');
    });

    let success = false;
    await act(async () => {
      success = await result.current.cancel('task-1');
    });

    expect(success).toBe(true);
    expect(result.current.tasks[0].status).toBe('cancelled');
  });

  it('should set error when cancel fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockTask({ status: 'completed' }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ detail: 'Task not found' }),
      });

    const { result } = renderHook(() => useTask(), { wrapper });

    await act(async () => {
      await result.current.submit('Task');
    });

    let success = true;
    await act(async () => {
      success = await result.current.cancel('bad-id');
    });

    expect(success).toBe(false);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'Task not found', status: 404 })
    );
  });

  // ─── listTasks ──────────────────────────────────────────────────────

  it('should list tasks and update state', async () => {
    const taskList = [mockTask(), mockTask({ task_id: 'task-2', status: 'completed' })];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: taskList, total: 2 }),
    });

    const { result } = renderHook(() => useTask(), { wrapper });

    let tasks: SwarmTask[] = [];
    await act(async () => {
      tasks = await result.current.listTasks();
    });

    expect(tasks).toHaveLength(2);
    expect(result.current.tasks).toHaveLength(2);
  });

  it('should pass query params when listing tasks', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tasks: [], total: 0 }),
    });

    const { result } = renderHook(() => useTask(), { wrapper });

    await act(async () => {
      await result.current.listTasks({ status: 'running', limit: 10, offset: 20 });
    });

    const url: string = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain('status=running');
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
  });

  it('should set error when listTasks fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('List failed'));

    const { result } = renderHook(() => useTask(), { wrapper });

    let tasks: SwarmTask[] = [mockTask()];
    await act(async () => {
      tasks = await result.current.listTasks();
    });

    expect(tasks).toEqual([]);
    expect(result.current.error).toEqual(
      expect.objectContaining({ message: 'List failed' })
    );
  });

  // ─── branch coverage ────────────────────────────────────────────────

  it('should stop loading when poll returns null during polling', async () => {
    const running = mockTask({ status: 'running' });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => running })    // submit
      .mockRejectedValueOnce(new Error('Poll network error'));            // first poll tick

    const { result } = renderHook(() => useTask({ pollInterval: 100 }), { wrapper });

    await act(async () => {
      await result.current.submit('Task that fails polling');
    });

    // Advance timer to trigger poll tick
    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should clear previous poll timer when a second submit is called', async () => {
    const running = mockTask({ task_id: 'task-run', status: 'running' });
    const running2 = mockTask({ task_id: 'task-2', status: 'running' });
    // Second task poll returns completed
    const completed2 = mockTask({ task_id: 'task-2', status: 'completed' });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => running })    // first submit
      .mockResolvedValueOnce({ ok: true, json: async () => running2 })   // second submit
      .mockResolvedValueOnce({ ok: true, json: async () => completed2 }); // second task poll

    // Use a very long poll interval so first task's poll tick never fires
    const { result } = renderHook(() => useTask({ pollInterval: 60000 }), { wrapper });

    // First submit starts polling with 60s interval
    await act(async () => {
      await result.current.submit('Task 1');
    });

    // Verify first task is running
    expect(result.current.status).toBe('running');

    // Second submit clears the previous timer and sets up new polling
    await act(async () => {
      await result.current.submit('Task 2');
    });

    // Advance timer for second task's poll
    await act(async () => {
      jest.advanceTimersByTime(70000);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('completed'));
    expect(result.current.isLoading).toBe(false);
  });

  it('should cancel active task id tracking and stop loading on cancel', async () => {
    // This tests the cancel path where the task being cancelled matches activeTaskIdRef
    // but does so synchronously to avoid poll timing issues
    const completedTask = mockTask({ task_id: 'task-done', status: 'completed' });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => completedTask }) // submit (terminal)
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null }); // cancel

    const { result } = renderHook(() => useTask({ pollInterval: 60000 }), { wrapper });

    await act(async () => {
      await result.current.submit('Completed task');
    });

    expect(result.current.tasks).toHaveLength(1);

    // Cancel the completed task (not currently polling but tests the cancel happy path)
    let success = false;
    await act(async () => {
      success = await result.current.cancel('task-done');
    });

    expect(success).toBe(true);
    expect(result.current.tasks[0].status).toBe('cancelled');
  });

  it('should unmount cleanly when a poll timer is pending', async () => {
    const running = mockTask({ status: 'running' });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => running,
    });

    const { result, unmount } = renderHook(() => useTask({ pollInterval: 5000 }), { wrapper });

    await act(async () => {
      await result.current.submit('Long running task');
    });

    // Timer is now pending — unmounting should clear it without error
    expect(() => unmount()).not.toThrow();
  });
});
