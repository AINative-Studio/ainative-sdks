/**
 * AINative Next.js SDK - Server Utilities
 *
 * Server-side utilities for Next.js App Router and Pages Router.
 * Use these in Server Components, Server Actions, and API routes.
 */

export { createServerClient } from './createServerClient';
export {
  getSession,
  getSessionFromCookie,
  getApiKey,
  getApiKeyFromCookie,
} from './getSession';
export { withAuth, withAuthPages } from './withAuth';

// Re-export types
export type {
  Session,
  ServerClient,
  ServerClientConfig,
  WithAuthOptions,
  AuthenticatedRequest,
} from '../types';
