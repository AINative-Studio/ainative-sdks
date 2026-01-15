/**
 * Example: Next.js App Router - Server Component
 *
 * Demonstrates using the Next.js SDK in a Server Component
 * to fetch credit balance and display it.
 */

import { createServerClient, getApiKey } from '@ainative/next-sdk/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  // Get API key from cookies
  const apiKey = await getApiKey();

  if (!apiKey) {
    redirect('/login');
  }

  // Create server client
  const client = createServerClient({ apiKey });

  try {
    // Fetch credit balance server-side
    const balance = await client.credits.balance();

    return (
      <div className="container">
        <h1>Dashboard</h1>

        <div className="card">
          <h2>Credit Balance</h2>
          <p>Plan: {balance.plan}</p>
          <p>Remaining: {balance.remaining_credits.toFixed(2)}</p>
          <p>Total: {balance.total_credits.toFixed(2)}</p>
          <p>Usage: {balance.usage_percentage.toFixed(1)}%</p>
        </div>

        <div className="card">
          <h2>Period</h2>
          <p>Start: {new Date(balance.period_start).toLocaleDateString()}</p>
          {balance.period_end && (
            <p>End: {new Date(balance.period_end).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="container">
        <h1>Error</h1>
        <p>Failed to load dashboard: {error.message}</p>
      </div>
    );
  }
}
