/**
 * Example: Next.js App Router - API Route
 *
 * Demonstrates using withAuth middleware to protect an API route
 * and create chat completions server-side.
 */

import { withAuth, createServerClient } from '@ainative/next-sdk/server';
import { NextRequest } from 'next/server';

export const POST = withAuth(async (req: NextRequest, { session, apiKey }) => {
  try {
    // Parse request body
    const body = await req.json();
    const { messages, model, temperature } = body;

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: 'Invalid request', message: 'messages is required' },
        { status: 400 }
      );
    }

    // Create server client with API key from session
    const client = createServerClient({ apiKey });

    // Create chat completion
    const response = await client.chat.completions.create({
      messages,
      preferred_model: model,
      temperature,
    });

    // Return response
    return Response.json({
      success: true,
      data: response,
      user: {
        id: session.userId,
        email: session.email,
      },
    });
  } catch (error: any) {
    console.error('Chat completion error:', error);
    return Response.json(
      { error: 'Chat completion failed', message: error.message },
      { status: 500 }
    );
  }
});
