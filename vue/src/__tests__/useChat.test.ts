/**
 * Tests for useChat composable
 *
 * Refs #8331 — useChat must fetch the real backend managed-chat route
 * (`/api/v1/managed/chat/completions`), not a nonexistent alias.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from 'vue';
import { AINativeConfigKey } from '../composables/useAINative';
import { useChat } from '../composables/useChat';

global.fetch = vi.fn();

/**
 * Run a composable in a fake Vue app context with config provided.
 */
function withApp<T>(fn: () => T, config: { apiKey: string; baseUrl?: string } = { apiKey: 'test-key' }): T {
  let result!: T;
  const app = createApp({ setup() { result = fn(); return {}; }, template: '<div/>' });
  app.provide(AINativeConfigKey, config);
  const mountPoint = document.createElement('div');
  app.mount(mountPoint);
  return result;
}

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to the real managed-chat backend route under /api/v1, not a nonexistent alias', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-url-check',
        choices: [{ message: { role: 'assistant', content: 'hi' } }],
      }),
    });

    const { sendMessage } = withApp(() => useChat(), { apiKey: 'test-key' });

    await sendMessage([{ role: 'user', content: 'Hello' }]);

    // Real backend mount (src/backend/app/api/api_v1/api.py):
    //   api_router.include_router(managed_chat_router, prefix="/managed", ...)
    //   under settings.API_V1_STR ("/api/v1")
    //   -> full path is /api/v1/managed/chat/completions
    // The default baseUrl here ('https://api.ainative.studio') does NOT
    // include /api/v1, so the composable must build that prefix itself.
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/managed\/chat\/completions$/),
      expect.any(Object)
    );
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/v1/public/chat/completions'),
      expect.any(Object)
    );
  });

  it('should append /api/v1/managed/chat/completions to a custom bare-host baseUrl', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-url-check-2',
        choices: [{ message: { role: 'assistant', content: 'hi' } }],
      }),
    });

    const { sendMessage } = withApp(() => useChat(), {
      apiKey: 'test-key',
      baseUrl: 'https://custom.api',
    });

    await sendMessage([{ role: 'user', content: 'Hello' }]);

    // baseUrl is always a bare host in this SDK's convention (see useAgent.ts:
    // `fetch(`${baseUrl}/api/v1${path}`, ...)`) — useChat must follow the same
    // pattern rather than hardcoding a version prefix of its own.
    expect(global.fetch).toHaveBeenCalledWith(
      'https://custom.api/api/v1/managed/chat/completions',
      expect.any(Object)
    );
  });
});
