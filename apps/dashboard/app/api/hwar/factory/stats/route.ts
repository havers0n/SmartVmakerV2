export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { harvests, hwar_analysis_tasks, hwar_workers, hwar_queues, hwar_batches } from "@/src/lib/schema";
import { count, eq } from "drizzle-orm";
import { serverError } from "@/src/lib/http";

type SuccessResponse = {
  ok: true;
  costToday: number;
  successRate: number;
  avgProcessingTime: number;
  videosAnalyzed: number;
};

export async function GET() {
  try {
    // For now, return mock data since we don't have the full schema for cost tracking
    // In a real implementation, you would query the actual tables and calculate these values
    const stats = {
      costToday: 66.93,
      successRate: 94.2,
      avgProcessingTime: 12.3,
      videosAnalyzed: 247
    };

    return NextResponse.json<SuccessResponse>({
      ok: true,
      ...stats
    });
  } catch (error) {
    console.error("[API] Error fetching factory stats:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}