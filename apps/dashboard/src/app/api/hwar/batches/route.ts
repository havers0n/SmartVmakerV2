export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { hwar_batches } from "@/shared/lib/schema";
import { desc } from "drizzle-orm";
import { serverError } from "@/shared/lib/http";

type SuccessResponse = {
  ok: true;
  batches: Array<{
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
      .from(hwar_batches)
      .orderBy(desc(hwar_batches.created_at))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      batches: rows.map((row: typeof hwar_batches.$inferSelect) => ({
        id: row.id,
        kind: row.kind,
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching batches:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}