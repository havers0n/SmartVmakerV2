export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getTrends } from '@/shared/trends';

/**
 * GET /api/analytics/trends
 *
 * Returns YouTube trend insights based on analyzed videos.
 * Currently returns static data - will be connected to analytics in the future.
 */
export async function GET() {
  try {
    const trends = getTrends();

    return NextResponse.json({ trends }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Trends API error:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
