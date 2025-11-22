export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

/**
 * GET /api/analytics/trends
 *
 * Returns YouTube trend insights based on analyzed videos.
 * Currently returns static data - will be connected to analytics in the future.
 */
export async function GET() {
  try {
    // Static trend data for now
    // In the future, this will query the analytics.analysis_results table
    const trends = [
      {
        id: 'trend-1',
        title: 'Emotional Hook Pattern',
        description: 'Using insights from 247 analyzed videos: Hook ≤ 2s, emphasis on close-up emotions',
        insights: ['Hook ≤ 2s', 'Close-up emotions', 'Payoff @ 17s median'],
        meta: {
          videosAnalyzed: 247,
          avgHookDuration: 1.8,
          avgPayoffTime: 17.2,
          topEmotions: ['anticipation', 'curiosity', 'surprise'],
        },
      },
      {
        id: 'trend-2',
        title: 'Fast-Paced Contrast',
        description: 'Quick cuts with strong contrasts perform 35% better in retention',
        insights: ['Small vs Big', 'Fast cuts (0.5-1s)', 'Problem → Solution'],
        meta: {
          videosAnalyzed: 189,
          avgCutDuration: 0.7,
          retentionBoost: 0.35,
          topContrasts: ['small_vs_big', 'problem_vs_solution', 'before_vs_after'],
        },
      },
      {
        id: 'trend-3',
        title: 'Empathy-Driven Arc',
        description: 'Stories starting with empathy show 28% higher engagement',
        insights: ['Empathy hook', 'Tension build', 'Relief payoff'],
        meta: {
          videosAnalyzed: 156,
          avgEngagementBoost: 0.28,
          topEmotions: ['empathy', 'tension', 'relief'],
          recommendedDuration: 45,
        },
      },
    ];

    return NextResponse.json(trends, {
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
