/**
 * Get session from JWT token stored in cookies
 *
 * Supports both App Router and Pages Router
 */

import { cookies } from 'next/headers';
import type { Session } from '../types';

/**
 * Decode JWT token without verification (server-side only)
 *
 * @param token - JWT token string
 * @returns Decoded session data or null if invalid
 */
function decodeJWT(token: string): Session | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);

    // Validate required fields
    if (!parsed.userId || !parsed.email || !parsed.exp || !parsed.iat) {
      return null;
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp < now) {
      return null;
    }

    return {
      userId: parsed.userId,
      email: parsed.email,
      exp: parsed.exp,
      iat: parsed.iat,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get session from cookies (App Router)
 *
 * Use this in Server Components and Server Actions.
 *
 * @param cookieName - Cookie name (default: 'ainative_token')
 * @returns Session data or null if not authenticated
 *
 * @example
 * ```tsx
 * // app/dashboard/page.tsx
 * import { getSession } from '@ainative/next-sdk/server';
 *
 * export default async function DashboardPage() {
 *   const session = await getSession();
 *
 *   if (!session) {
 *     redirect('/login');
 *   }
 *
 *   return <div>Welcome {session.email}</div>;
 * }
 * ```
 */
export async function getSession(cookieName = 'ainative_token'): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieName)?.value;

    if (!token) {
      return null;
    }

    return decodeJWT(token);
  } catch (error) {
    return null;
  }
}

/**
 * Get session from cookies (Pages Router)
 *
 * Use this in getServerSideProps or API routes.
 *
 * @param cookieHeader - Cookie header string from request
 * @param cookieName - Cookie name (default: 'ainative_token')
 * @returns Session data or null if not authenticated
 *
 * @example
 * ```tsx
 * // pages/dashboard.tsx
 * import { getSessionFromCookie } from '@ainative/next-sdk/server';
 *
 * export async function getServerSideProps({ req }) {
 *   const session = getSessionFromCookie(req.headers.cookie);
 *
 *   if (!session) {
 *     return { redirect: { destination: '/login', permanent: false } };
 *   }
 *
 *   return { props: { session } };
 * }
 * ```
 */
export function getSessionFromCookie(
  cookieHeader: string | undefined,
  cookieName = 'ainative_token'
): Session | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const tokenCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));

  if (!tokenCookie) {
    return null;
  }

  const token = tokenCookie.substring(cookieName.length + 1);
  return decodeJWT(token);
}

/**
 * Get API key from cookies (App Router)
 *
 * @param cookieName - Cookie name (default: 'ainative_token')
 * @returns JWT token or null
 */
export async function getApiKey(cookieName = 'ainative_token'): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieName)?.value;
    return token || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get API key from cookie header (Pages Router)
 *
 * @param cookieHeader - Cookie header string from request
 * @param cookieName - Cookie name (default: 'ainative_token')
 * @returns JWT token or null
 */
export function getApiKeyFromCookie(
  cookieHeader: string | undefined,
  cookieName = 'ainative_token'
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const tokenCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));

  if (!tokenCookie) {
    return null;
  }

  return tokenCookie.substring(cookieName.length + 1);
}
