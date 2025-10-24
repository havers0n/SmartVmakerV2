export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { harvests } from "@/src/lib/schema";
import { desc } from "drizzle-orm";
import { serverError } from "@/src/lib/http";

type SuccessResponse = {
  ok: true;
  harvests: Array<{
    id: string;
    query: string;
    createdAt: Date;
  }>;
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(harvests)
      .orderBy(desc(harvests.createdAt))
      .limit(50);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      harvests: rows.map((row: typeof harvests.$inferSelect) => ({
        id: row.id,
        query: row.query,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching harvests:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}
