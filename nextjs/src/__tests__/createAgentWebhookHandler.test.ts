/**
 * Tests for createAgentWebhookHandler
 *
 * Refs ainative-website#1105
 */

import { createAgentWebhookHandler } from '../server/createAgentWebhookHandler';
import type { SwarmTask } from '../server/createAgentServerClient';

function mockTask(overrides: Partial<SwarmTask> = {}): SwarmTask {
  return {
    task_id: 'task-1',
    status: 'completed',
    description: 'Test task',
    agent_types: ['analyst'],
    config: {},
    result: { summary: 'done' },
    agents_used: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── App Router helper ────────────────────────────────────────────────────────

function makeRequest(body: unknown, method = 'POST'): Request {
  return {
    method,
    json: async () => body,
  } as unknown as Request;
}

describe('createAgentWebhookHandler', () => {
  // ─── appRouter ──────────────────────────────────────────────────────

  describe('appRouter', () => {
    it('should return 405 for non-POST methods', async () => {
      const handler = createAgentWebhookHandler({});
      const res = await handler.appRouter(makeRequest({}, 'GET'));
      expect(res.status).toBe(405);
    });

    it('should return 400 when body is missing required fields', async () => {
      const handler = createAgentWebhookHandler({});
      const res = await handler.appRouter(makeRequest({ event: 'task.completed' }));
      expect(res.status).toBe(400);
    });

    it('should return 400 when JSON parsing fails', async () => {
      const handler = createAgentWebhookHandler({});
      const badReq = {
        method: 'POST',
        json: async () => { throw new Error('Bad JSON'); },
      } as unknown as Request;
      const res = await handler.appRouter(badReq);
      expect(res.status).toBe(400);
    });

    it('should call onTaskComplete and return 200 for completed task', async () => {
      const onTaskComplete = jest.fn().mockResolvedValueOnce(undefined);
      const handler = createAgentWebhookHandler({ onTaskComplete });

      const payload = {
        event: 'task.completed',
        task: mockTask({ status: 'completed' }),
        timestamp: '2026-01-01T00:00:00Z',
      };

      const res = await handler.appRouter(makeRequest(payload));
      expect(res.status).toBe(200);
      expect(onTaskComplete).toHaveBeenCalledWith(payload.task);

      const body = await res.json();
      expect(body).toEqual({ received: true });
    });

    it('should call onTaskFailed for failed task', async () => {
      const onTaskFailed = jest.fn().mockResolvedValueOnce(undefined);
      const handler = createAgentWebhookHandler({ onTaskFailed });

      const payload = {
        event: 'task.failed',
        task: mockTask({ status: 'failed', result: null }),
        timestamp: '2026-01-01T00:00:00Z',
      };

      const res = await handler.appRouter(makeRequest(payload));
      expect(res.status).toBe(200);
      expect(onTaskFailed).toHaveBeenCalledWith(payload.task);
    });

    it('should call onTaskCancelled for cancelled task', async () => {
      const onTaskCancelled = jest.fn().mockResolvedValueOnce(undefined);
      const handler = createAgentWebhookHandler({ onTaskCancelled });

      const payload = {
        event: 'task.cancelled',
        task: mockTask({ status: 'cancelled', result: null }),
        timestamp: '2026-01-01T00:00:00Z',
      };

      const res = await handler.appRouter(makeRequest(payload));
      expect(res.status).toBe(200);
      expect(onTaskCancelled).toHaveBeenCalledWith(payload.task);
    });

    it('should return 200 when no handler matches task status', async () => {
      const handler = createAgentWebhookHandler({ onTaskComplete: jest.fn() });

      const payload = {
        event: 'task.failed',
        task: mockTask({ status: 'failed' }),
        timestamp: '2026-01-01T00:00:00Z',
      };

      const res = await handler.appRouter(makeRequest(payload));
      expect(res.status).toBe(200);
    });

    it('should return 500 when handler throws', async () => {
      const onTaskComplete = jest.fn().mockRejectedValueOnce(new Error('Handler failed'));
      const handler = createAgentWebhookHandler({ onTaskComplete });

      const payload = {
        event: 'task.completed',
        task: mockTask({ status: 'completed' }),
        timestamp: '2026-01-01T00:00:00Z',
      };

      const res = await handler.appRouter(makeRequest(payload));
      expect(res.status).toBe(500);

      const body = await res.json();
      expect(body.error).toBe('Handler failed');
    });
  });

  // ─── pagesRouter ────────────────────────────────────────────────────

  describe('pagesRouter', () => {
    function mockRes() {
      const res: { statusCode: number; body: unknown; status: jest.Mock; json: jest.Mock } = {
        statusCode: 200,
        body: null,
        status: jest.fn().mockImplementation((code: number) => { res.statusCode = code; return res; }),
        json: jest.fn().mockImplementation((data: unknown) => { res.body = data; }),
      };
      return res;
    }

    it('should return 405 for non-POST methods', async () => {
      const handler = createAgentWebhookHandler({});
      const req = { method: 'GET', body: {} };
      const res = mockRes();

      await handler.pagesRouter(req, res);
      expect(res.statusCode).toBe(405);
    });

    it('should return 400 when body is missing fields', async () => {
      const handler = createAgentWebhookHandler({});
      const req = { method: 'POST', body: {} };
      const res = mockRes();

      await handler.pagesRouter(req, res);
      expect(res.statusCode).toBe(400);
    });

    it('should call onTaskComplete and respond 200', async () => {
      const onTaskComplete = jest.fn().mockResolvedValueOnce(undefined);
      const handler = createAgentWebhookHandler({ onTaskComplete });

      const task = mockTask({ status: 'completed' });
      const req = {
        method: 'POST',
        body: { event: 'task.completed', task, timestamp: '2026-01-01T00:00:00Z' },
      };
      const res = mockRes();

      await handler.pagesRouter(req, res);
      expect(res.statusCode).toBe(200);
      expect(onTaskComplete).toHaveBeenCalledWith(task);
      expect(res.body).toEqual({ received: true });
    });

    it('should return 500 when handler throws', async () => {
      const onTaskComplete = jest.fn().mockRejectedValueOnce(new Error('Pages error'));
      const handler = createAgentWebhookHandler({ onTaskComplete });

      const task = mockTask({ status: 'completed' });
      const req = {
        method: 'POST',
        body: { event: 'task.completed', task, timestamp: '2026-01-01T00:00:00Z' },
      };
      const res = mockRes();

      await handler.pagesRouter(req, res);
      expect(res.statusCode).toBe(500);
      expect((res.body as { error: string }).error).toBe('Pages error');
    });
  });
});
