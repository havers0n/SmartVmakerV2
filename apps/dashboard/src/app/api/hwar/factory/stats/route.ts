export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { serverError } from "@/shared/lib/http";
import { db } from "@/shared/lib/db";
import { analysisJobQueue, youtubeVideos, generationProjects } from "@/shared/lib/schema";
import { count, sql, gte } from "drizzle-orm";

type SuccessResponse = {
  ok: true;
  costToday: number;
  successRate: number;
  avgProcessingTime: number;
  videosAnalyzed: number;
};

export async function GET() {
  try {
    // Get start of today in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Run all queries in parallel for better performance
    const [costResult, analysisStats, videosCount] = await Promise.all([
      // Calculate total API costs for today from generation projects
      db
        .select({
          total: sql<number>`COALESCE(SUM(CAST(${generationProjects.api_cost_usd} AS DECIMAL)), 0)`,
        })
        .from(generationProjects)
        .where(gte(generationProjects.created_at, today)),

      // Calculate success rate and avg processing time from analysis jobs
      db
        .select({
          total: count(),
          completed: sql<number>`COUNT(CASE WHEN ${analysisJobQueue.status} = 'completed' THEN 1 END)`,
          avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${analysisJobQueue.updated_at} - ${analysisJobQueue.created_at})))`,
        })
        .from(analysisJobQueue)
        .where(gte(analysisJobQueue.created_at, today)),

      // Count videos analyzed today
      db
        .select({ count: count() })
        .from(youtubeVideos)
        .where(gte(youtubeVideos.created_at, today)),
    ]);

    const totalJobs = analysisStats[0]?.total || 0;
    const completedJobs = Number(analysisStats[0]?.completed || 0);
    const avgTimeSeconds = Number(analysisStats[0]?.avgTime || 0);

    const stats = {
      costToday: Number(costResult[0]?.total || 0),
      successRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
      avgProcessingTime: avgTimeSeconds,
      videosAnalyzed: videosCount[0]?.count || 0,
    };

    return NextResponse.json<SuccessResponse>({
      ok: true,
      ...stats,
    });
  } catch (error) {
    console.error("[API] Error fetching factory stats:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}