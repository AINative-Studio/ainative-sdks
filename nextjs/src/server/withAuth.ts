/**
 * Higher-order function for API route authentication
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { WithAuthOptions, Session } from '../types';
import { getSessionFromCookie, getApiKeyFromCookie } from './getSession';

/**
 * Request handler with authentication
 */
type AuthHandler = (
  req: NextRequest,
  context: { session: Session; apiKey: string; params?: any }
) => Promise<Response> | Response;

/**
 * Wrap API route handler with authentication
 *
 * Use this to protect API routes in both App Router and Pages Router.
 *
 * @param handler - Route handler function
 * @param options - Authentication options
 * @returns Protected route handler
 *
 * @example
 * ```tsx
 * // app/api/chat/route.ts
 * import { withAuth } from '@ainative/next-sdk/server';
 * import { createServerClient } from '@ainative/next-sdk/server';
 *
 * export const POST = withAuth(async (req, { session, apiKey }) => {
 *   const client = createServerClient({ apiKey });
 *   const body = await req.json();
 *
 *   const response = await client.chat.completions.create({
 *     messages: body.messages,
 *   });
 *
 *   return Response.json(response);
 * });
 * ```
 */
export function withAuth(handler: AuthHandler, options: WithAuthOptions = {}) {
  const cookieName = options.cookieName || 'ainative_token';

  return async (req: NextRequest, context?: { params: any }) => {
    try {
      // Get cookie from request
      const cookieHeader = req.headers.get('cookie');
      const session = getSessionFromCookie(cookieHeader || undefined, cookieName);

      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }

      // Get API key
      const apiKey = getApiKeyFromCookie(cookieHeader || undefined, cookieName);

      if (!apiKey) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'API key not found' },
          { status: 401 }
        );
      }

      // Call handler with session and apiKey
      return await handler(req, {
        session,
        apiKey,
        params: context?.params,
      });
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Internal Server Error', message: 'Authentication failed' },
        { status: 500 }
      );
    }
  };
}

/**
 * Wrap Pages Router API handler with authentication
 *
 * Use this for API routes in the pages directory.
 *
 * @param handler - Route handler function
 * @param options - Authentication options
 * @returns Protected route handler
 *
 * @example
 * ```tsx
 * // pages/api/chat.ts
 * import { withAuthPages } from '@ainative/next-sdk/server';
 * import { createServerClient } from '@ainative/next-sdk/server';
 * import type { NextApiRequest, NextApiResponse } from 'next';
 *
 * export default withAuthPages(async (req, res, { session, apiKey }) => {
 *   const client = createServerClient({ apiKey });
 *
 *   const response = await client.chat.completions.create({
 *     messages: req.body.messages,
 *   });
 *
 *   res.status(200).json(response);
 * });
 * ```
 */
export function withAuthPages(
  handler: (
    req: any,
    res: any,
    context: { session: Session; apiKey: string }
  ) => Promise<void> | void,
  options: WithAuthOptions = {}
) {
  const cookieName = options.cookieName || 'ainative_token';

  return async (req: any, res: any) => {
    try {
      const cookieHeader = req.headers.cookie;
      const session = getSessionFromCookie(cookieHeader, cookieName);

      if (!session) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const apiKey = getApiKeyFromCookie(cookieHeader, cookieName);

      if (!apiKey) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'API key not found',
        });
      }

      return await handler(req, res, { session, apiKey });
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication failed',
      });
    }
  };
}
