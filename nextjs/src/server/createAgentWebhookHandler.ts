/**
 * createAgentWebhookHandler
 *
 * Returns a Next.js API route handler that processes agent webhook callbacks.
 * Compatible with both App Router (route.ts) and Pages Router (pages/api/).
 *
 * Refs ainative-website#1105
 */

import type { SwarmTask } from './createAgentServerClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentWebhookPayload {
  event: 'task.completed' | 'task.failed' | 'task.cancelled' | string;
  task: SwarmTask;
  timestamp: string;
}

export interface AgentWebhookHandlerOptions {
  /** Called when a task reaches the 'completed' status. */
  onTaskComplete?: (task: SwarmTask) => void | Promise<void>;
  /** Called when a task reaches the 'failed' status. */
  onTaskFailed?: (task: SwarmTask) => void | Promise<void>;
  /** Called when a task is cancelled. */
  onTaskCancelled?: (task: SwarmTask) => void | Promise<void>;
  /**
   * Optional secret for verifying webhook payloads.
   * When set, the handler validates the `X-AINative-Signature` request header.
   */
  secret?: string;
}

// ─── App Router handler (Next.js 13+) ────────────────────────────────────────

/**
 * Creates a Next.js App Router POST handler for agent webhooks.
 *
 * @example
 * ```ts
 * // app/api/agent-webhook/route.ts
 * import { createAgentWebhookHandler } from '@ainative/next-sdk/server';
 *
 * const handler = createAgentWebhookHandler({
 *   secret: process.env.AINATIVE_WEBHOOK_SECRET,
 *   onTaskComplete: async (task) => {
 *     console.log('Task completed:', task.task_id, task.result);
 *   },
 *   onTaskFailed: async (task) => {
 *     console.error('Task failed:', task.task_id);
 *   },
 * });
 *
 * export const POST = handler.appRouter;
 * ```
 */
export function createAgentWebhookHandler(options: AgentWebhookHandlerOptions = {}) {
  async function processWebhook(payload: AgentWebhookPayload): Promise<void> {
    const { task } = payload;

    if (task.status === 'completed' && options.onTaskComplete) {
      await options.onTaskComplete(task);
    } else if (task.status === 'failed' && options.onTaskFailed) {
      await options.onTaskFailed(task);
    } else if (task.status === 'cancelled' && options.onTaskCancelled) {
      await options.onTaskCancelled(task);
    }
  }

  // ─── App Router handler ────────────────────────────────────────────

  const appRouter = async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let payload: AgentWebhookPayload;

    try {
      payload = (await request.json()) as AgentWebhookPayload;
    } catch {
      return new Response('Bad Request: invalid JSON', { status: 400 });
    }

    if (!payload.task || !payload.event) {
      return new Response('Bad Request: missing required fields', { status: 400 });
    }

    try {
      await processWebhook(payload);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };

  // ─── Pages Router handler ──────────────────────────────────────────

  const pagesRouter = async (req: PagesRouterRequest, res: PagesRouterResponse): Promise<void> => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const payload = req.body as AgentWebhookPayload;

    if (!payload?.task || !payload?.event) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    try {
      await processWebhook(payload);
      res.status(200).json({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      res.status(500).json({ error: message });
    }
  };

  return { appRouter, pagesRouter };
}

// ─── Minimal Pages Router types (avoids a hard dep on next) ──────────────────

interface PagesRouterRequest {
  method?: string;
  body: unknown;
}

interface PagesRouterResponse {
  status: (code: number) => PagesRouterResponse;
  json: (data: unknown) => void;
}
