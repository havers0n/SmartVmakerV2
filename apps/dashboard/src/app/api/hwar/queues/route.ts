export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { hwar_queues } from "@/src/lib/schema";
import { desc } from "drizzle-orm";
import { serverError } from "@/src/lib/http";

type SuccessResponse = {
  ok: true;
  queues: Array<{
    id: string;
    name: string;
    size: number;
    updatedAt: Date;
  }>;
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(hwar_queues)
      .orderBy(desc(hwar_queues.updatedAt))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      queues: rows.map((row: typeof hwar_queues.$inferSelect) => ({
        id: row.id,
        name: row.name,
        size: row.size || 0,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching queues:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}