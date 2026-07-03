import { NextResponse } from 'next/server';
import { getDrizzleClient, schema } from '@scrimspec/db';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  forbiddenResponse,
  getTrustedUserId,
  isAdminUser,
  unauthorizedResponse,
} from '@/shared/lib/auth';

export const dynamic = 'force-dynamic';

type IngestOverview = {
  activeWorkers: number;
  ingestedToday: number;
  pendingAnalysis: number;
};

export async function GET(request: Request) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  if (!isAdminUser(userId)) return forbiddenResponse('Admin access required');

  const db = getDrizzleClient();

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Heuristic: active workers ~= number of processing jobs locked recently.
    // We intentionally keep this lightweight (no extra heartbeat tables required).
    const activeThreshold = new Date(Date.now() - 60_000).toISOString();

    const [{ activeWorkers = 0 } = {}] = await db
      .select({
        activeWorkers: sql<number>`count(*)`,
      })
      .from(schema.ingestJobQueue)
      .where(
        and(
          eq(schema.ingestJobQueue.status, 'processing'),
          gt(schema.ingestJobQueue.lockedAt, activeThreshold)
        )
      );

    const [{ ingestedToday = 0 } = {}] = await db
      .select({
        ingestedToday: sql<number>`count(*)`,
      })
      .from(schema.youtubeVideos)
      .where(gt(schema.youtubeVideos.createdAt, todayStart.toISOString()));

    const [{ pendingAnalysis = 0 } = {}] = await db
      .select({
        pendingAnalysis: sql<number>`count(*)`,
      })
      .from(schema.analysisJobQueue)
      .where(inArray(schema.analysisJobQueue.status, ['pending', 'processing']));

    const overview: IngestOverview = {
      activeWorkers,
      ingestedToday,
      pendingAnalysis,
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error('[ingest.overview] failed:', error);
    return NextResponse.json(
      { error: 'Failed to load ingest overview' },
      { status: 500 }
    );
  }
}
