/**
 * Example: Next.js Pages Router - Server-Side Rendering
 *
 * Demonstrates using getServerSideProps to fetch data server-side
 * and protect pages with session validation.
 */

import { GetServerSideProps } from 'next';
import { getSessionFromCookie, createServerClient, getApiKeyFromCookie } from '@ainative/next-sdk/server';
import type { Session, CreditBalance } from '@ainative/next-sdk';

interface DashboardProps {
  session: Session;
  balance: CreditBalance;
}

export default function DashboardPage({ session, balance }: DashboardProps) {
  return (
    <div className="container">
      <h1>Dashboard</h1>

      <div className="card">
        <h2>User Info</h2>
        <p>Email: {session.email}</p>
        <p>User ID: {session.userId}</p>
      </div>

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
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  // Get session from cookie
  const session = getSessionFromCookie(req.headers.cookie);

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  // Get API key
  const apiKey = getApiKeyFromCookie(req.headers.cookie);

  if (!apiKey) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  try {
    // Create server client and fetch balance
    const client = createServerClient({ apiKey });
    const balance = await client.credits.balance();

    return {
      props: {
        session,
        balance,
      },
    };
  } catch (error) {
    console.error('Failed to fetch balance:', error);

    return {
      redirect: {
        destination: '/error',
        permanent: false,
      },
    };
  }
};
