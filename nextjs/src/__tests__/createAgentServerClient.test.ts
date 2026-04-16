/**
 * Tests for createAgentServerClient
 *
 * Refs ainative-website#1105
 */

import { createAgentServerClient } from '../server/createAgentServerClient';
import type { AgentRegistration, SwarmTask, Memory, Thread } from '../server/createAgentServerClient';

// Mock fetch globally
global.fetch = jest.fn();

const API_KEY = 'test-api-key';
const BASE_URL = 'https://api.test.com/api/v1';

function mockFetchOk(data: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    status,
    json: async () => data,
  });
}

function mockFetchError(status: number, detail: string) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({ detail }),
  });
}

const mockAgent: AgentRegistration = {
  id: 'agent-1',
  name: 'Test Agent',
  agent_type: 'assistant',
  capabilities: ['chat'],
  oversight_level: 'standard',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
};

const mockTask = (overrides: Partial<SwarmTask> = {}): SwarmTask => ({
  task_id: 'task-1',
  status: 'completed',
  description: 'Test task',
  agent_types: ['analyst'],
  config: {},
  result: null,
  agents_used: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('createAgentServerClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Config ─────────────────────────────────────────────────────────

  it('should throw when no API key is provided and env var is absent', () => {
    const original = process.env.AINATIVE_API_KEY;
    delete process.env.AINATIVE_API_KEY;

    expect(() => createAgentServerClient()).toThrow('AINative API key is required');

    process.env.AINATIVE_API_KEY = original;
  });

  it('should use AINATIVE_API_KEY env var as fallback', () => {
    process.env.AINATIVE_API_KEY = 'env-key';
    expect(() => createAgentServerClient()).not.toThrow();
    delete process.env.AINATIVE_API_KEY;
  });

  it('should use default baseUrl when not provided', async () => {
    mockFetchOk([]);
    const client = createAgentServerClient({ apiKey: API_KEY });
    await client.agent.list();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.ainative.studio/api/v1/auth/agents',
      expect.any(Object)
    );
  });

  // ─── agent ──────────────────────────────────────────────────────────

  describe('agent.list', () => {
    it('should GET /auth/agents', async () => {
      mockFetchOk([mockAgent]);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const agents = await client.agent.list();

      expect(agents).toEqual([mockAgent]);
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/auth/agents`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ Authorization: `Bearer ${API_KEY}` }),
        })
      );
    });

    it('should throw on error response', async () => {
      mockFetchError(401, 'Invalid API key');
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      await expect(client.agent.list()).rejects.toThrow('Invalid API key');
    });
  });

  describe('agent.get', () => {
    it('should GET /auth/agents/:id', async () => {
      mockFetchOk(mockAgent);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const agent = await client.agent.get('agent-1');

      expect(agent).toEqual(mockAgent);
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/auth/agents/agent-1`,
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('agent.create', () => {
    it('should POST /auth/agents/register', async () => {
      mockFetchOk(mockAgent);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const agent = await client.agent.create({
        name: 'Test Agent',
        agent_type: 'assistant',
        capabilities: ['chat'],
      });

      expect(agent).toEqual(mockAgent);
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/auth/agents/register`,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('agent.remove', () => {
    it('should DELETE /auth/agents/:id', async () => {
      mockFetchOk(null, 204);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      await expect(client.agent.remove('agent-1')).resolves.toBeNull();

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/auth/agents/agent-1`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  // ─── task ───────────────────────────────────────────────────────────

  describe('task.submit', () => {
    it('should POST /agent-swarm/tasks', async () => {
      const task = mockTask();
      mockFetchOk(task);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const result = await client.task.submit('Analyse data', ['analyst'], { priority: 'high' });

      expect(result).toEqual(task);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.description).toBe('Analyse data');
      expect(body.agent_types).toEqual(['analyst']);
      expect(body.config).toEqual({ priority: 'high' });
    });
  });

  describe('task.get', () => {
    it('should GET /agent-swarm/tasks/:id', async () => {
      const task = mockTask({ status: 'running' });
      mockFetchOk(task);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const result = await client.task.get('task-1');

      expect(result).toEqual(task);
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/agent-swarm/tasks/task-1`,
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('task.cancel', () => {
    it('should DELETE /agent-swarm/tasks/:id', async () => {
      mockFetchOk(null, 204);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      await expect(client.task.cancel('task-1')).resolves.toBeNull();
    });
  });

  describe('task.list', () => {
    it('should GET /agent-swarm/tasks with query params', async () => {
      mockFetchOk({ tasks: [], total: 0 });
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      await client.task.list({ status: 'running', limit: 10, offset: 5 });

      const url: string = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(url).toContain('status=running');
      expect(url).toContain('limit=10');
      expect(url).toContain('offset=5');
    });
  });

  // ─── memory ─────────────────────────────────────────────────────────

  describe('memory.remember', () => {
    it('should POST /public/memory/v2/remember', async () => {
      const mem: Memory = {
        id: 'mem-1',
        content: 'Test',
        memory_type: 'fact',
        importance: 0.5,
        tags: [],
        metadata: {},
        created_at: '2026-01-01T00:00:00Z',
      };
      mockFetchOk(mem);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const result = await client.memory.remember('Test', { entity_id: 'user-1', tags: ['fact'] });

      expect(result).toEqual(mem);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.content).toBe('Test');
      expect(body.entity_id).toBe('user-1');
    });
  });

  describe('memory.recall', () => {
    it('should POST /public/memory/v2/recall', async () => {
      mockFetchOk([]);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const results = await client.memory.recall('dark mode', { entity_id: 'user-1' });

      expect(results).toEqual([]);
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/public/memory/v2/recall`,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('memory.forget', () => {
    it('should DELETE /public/memory/v2/forget/:id', async () => {
      mockFetchOk(null, 204);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      await expect(client.memory.forget('mem-1')).resolves.toBeNull();

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/public/memory/v2/forget/mem-1`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  // ─── thread ─────────────────────────────────────────────────────────

  const mockThread: Thread = {
    id: 'thread-1',
    title: 'Test Thread',
    agent_types: [],
    model: null,
    status: 'active',
    message_count: 0,
    last_message_at: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
  };

  describe('thread.list', () => {
    it('should GET /threads with params', async () => {
      mockFetchOk([mockThread]);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const threads = await client.thread.list({ limit: 5, status: 'active' });

      expect(threads).toEqual([mockThread]);
      const url: string = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(url).toContain('limit=5');
      expect(url).toContain('status=active');
    });
  });

  describe('thread.get', () => {
    it('should GET /threads/:id', async () => {
      mockFetchOk({ ...mockThread, messages: [] });
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const thread = await client.thread.get('thread-1');

      expect(thread.id).toBe('thread-1');
    });
  });

  describe('thread.create', () => {
    it('should POST /threads', async () => {
      mockFetchOk(mockThread);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const thread = await client.thread.create('Test Thread', ['assistant']);

      expect(thread).toEqual(mockThread);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.title).toBe('Test Thread');
      expect(body.agent_types).toEqual(['assistant']);
    });
  });

  describe('thread.appendMessage', () => {
    it('should POST /threads/:id/messages', async () => {
      const msg = { id: 'msg-1', thread_id: 'thread-1', role: 'user', content: 'Hi', tool_calls: null, tokens_used: null, created_at: '2026-01-01T00:00:00Z' };
      mockFetchOk(msg);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const result = await client.thread.appendMessage('thread-1', { role: 'user', content: 'Hi' });

      expect(result).toEqual(msg);
      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/threads/thread-1/messages`,
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('thread.fork', () => {
    it('should POST /threads/:id/fork', async () => {
      const forked = { ...mockThread, id: 'thread-fork' };
      mockFetchOk(forked);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      const thread = await client.thread.fork('thread-1', 'msg-1', 'Forked');

      expect(thread).toEqual(forked);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.message_id).toBe('msg-1');
      expect(body.title).toBe('Forked');
    });
  });

  describe('thread.remove', () => {
    it('should DELETE /threads/:id', async () => {
      mockFetchOk(null, 204);
      const client = createAgentServerClient({ apiKey: API_KEY, baseUrl: BASE_URL });
      await expect(client.thread.remove('thread-1')).resolves.toBeNull();

      expect(global.fetch).toHaveBeenCalledWith(
        `${BASE_URL}/threads/thread-1`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});
