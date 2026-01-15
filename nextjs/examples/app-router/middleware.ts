/**
 * Example: Next.js App Router - Middleware
 *
 * Demonstrates using the SDK to check authentication in middleware
 * and redirect unauthenticated users.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get token from cookies
  const token = request.cookies.get('ainative_token')?.value;

  // Check if accessing protected route
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard');

  if (isProtectedRoute && !token) {
    // Redirect to login if no token
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Allow request to continue
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
