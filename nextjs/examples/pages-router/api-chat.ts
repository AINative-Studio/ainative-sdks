/**
 * Example: Next.js Pages Router - API Route
 *
 * Demonstrates using withAuthPages middleware to protect an API route
 * and handle chat completions.
 */

import { withAuthPages, createServerClient } from '@ainative/next-sdk/server';
import type { NextApiRequest, NextApiResponse } from 'next';

export default withAuthPages(async (req: NextApiRequest, res: NextApiResponse, { session, apiKey }) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, model, temperature } = req.body;

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'messages is required',
      });
    }

    // Create server client
    const client = createServerClient({ apiKey });

    // Create chat completion
    const response = await client.chat.completions.create({
      messages,
      preferred_model: model,
      temperature,
    });

    // Return response
    return res.status(200).json({
      success: true,
      data: response,
      user: {
        id: session.userId,
        email: session.email,
      },
    });
  } catch (error: any) {
    console.error('Chat completion error:', error);
    return res.status(500).json({
      error: 'Chat completion failed',
      message: error.message,
    });
  }
});
