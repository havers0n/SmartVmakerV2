export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { hwar_analysis_tasks } from "@/shared/lib/schema";
import { desc } from "drizzle-orm";
import { serverError } from "@/shared/lib/http";

type SuccessResponse = {
  ok: true;
  tasks: Array<{
    id: string;
    kind: string;
    status: string;
    createdAt: Date;
  }>;
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(hwar_analysis_tasks)
      .orderBy(desc(hwar_analysis_tasks.created_at))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      tasks: rows.map((row: typeof hwar_analysis_tasks.$inferSelect) => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching analysis tasks:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}