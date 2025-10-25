/**
 * POST /api/generation/shorts
 * Create a new short from a template and enqueue generation jobs.
 */

import { NextResponse } from 'next/server';
import { createShortAndEnqueue } from '@scrimspec/orchestrator/src/services/generationService';

export async function POST(req: Request) {
  try {
    const { templateId, provider = 'minimax' } = await req.json();

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 },
      );
    }

    if (!['minimax', 'hailuo'].includes(provider)) {
      return NextResponse.json(
        { error: 'provider must be "minimax" or "hailuo"' },
        { status: 400 },
      );
    }

    const { shortId, enqueued } = await createShortAndEnqueue(
      templateId,
      provider as 'minimax' | 'hailuo',
    );

    return NextResponse.json({
      ok: true,
      shortId,
      enqueued,
      message: `Created short ${shortId} with ${enqueued} assets enqueued for generation`,
    });

  } catch (error) {
    console.error('[API] Error creating short:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/generation/shorts
 * List all shorts with their status.
 */

import { listShorts } from '@scrimspec/orchestrator/src/services/generationService';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    const shorts = await listShorts(limit);

    return NextResponse.json({
      ok: true,
      count: shorts.length,
      shorts,
    });

  } catch (error) {
    console.error('[API] Error listing shorts:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
