export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { hwar_analysis_tasks } from "@/src/lib/schema";
import { desc, eq } from "drizzle-orm";
import { serverError } from "@/src/lib/http";
import { z } from "zod";

type SuccessResponse = {
  ok: true;
  tasks: Array<{
    id: string;
    kind: string;
    status: string;
    createdAt: Date;
  }>;
};

type ErrorResponse = {
  ok: false;
  error: string;
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(hwar_analysis_tasks)
      .orderBy(desc(hwar_analysis_tasks.createdAt))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      tasks: rows.map((row: typeof hwar_analysis_tasks.$inferSelect) => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching analysis tasks:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}

const AnalysisTaskSchema = z.object({
  id: z.string(),
});

export async function GET_BY_ID(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = AnalysisTaskSchema.parse(params);
    
    const rows = await db
      .select()
      .from(hwar_analysis_tasks)
      .where(eq(hwar_analysis_tasks.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json<ErrorResponse>(
        { ok: false, error: "Analysis task not found" },
        { status: 404 }
      );
    }

    const task = rows[0];
    
    return NextResponse.json<SuccessResponse>({
      ok: true,
      tasks: [{
        id: task.id,
        kind: task.kind,
        status: task.status,
        createdAt: task.createdAt,
      }],
    });
  } catch (error) {
    console.error("[API] Error fetching analysis task:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}