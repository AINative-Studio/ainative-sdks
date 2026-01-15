/**
 * AINative Next.js SDK
 *
 * Official Next.js SDK for AINative Studio API.
 * Provides server and client utilities for App Router and Pages Router.
 *
 * @example Server Component (App Router)
 * ```tsx
 * import { createServerClient, getApiKey } from '@ainative/next-sdk/server';
 *
 * export default async function Page() {
 *   const apiKey = await getApiKey();
 *   const client = createServerClient({ apiKey });
 *   const balance = await client.credits.balance();
 *   return <div>Credits: {balance.remaining_credits}</div>;
 * }
 * ```
 *
 * @example Client Component
 * ```tsx
 * 'use client';
 * import { AINativeProvider, useChat } from '@ainative/next-sdk/client';
 *
 * export function ChatComponent({ apiKey }) {
 *   return (
 *     <AINativeProvider config={{ apiKey }}>
 *       <Chat />
 *     </AINativeProvider>
 *   );
 * }
 * ```
 */

// Server exports (use in Server Components and API routes)
export {
  createServerClient,
  getSession,
  getSessionFromCookie,
  getApiKey,
  getApiKeyFromCookie,
  withAuth,
  withAuthPages,
} from './server';

// Client exports (use in Client Components)
export {
  AINativeProvider,
  useAINative,
  useChat,
  useCredits,
} from './client';

// Type exports
export type {
  // Server types
  Session,
  ServerClient,
  ServerClientConfig,
  WithAuthOptions,
  AuthenticatedRequest,
  // Client types (re-exported from React SDK)
  AINativeConfig,
  Message,
  ChatCompletionRequest,
  ChatCompletionResponse,
  Usage,
  CreditBalance,
  AINativeError,
  ChatState,
  UseChatOptions,
  UseCreditsReturn,
} from './types';
