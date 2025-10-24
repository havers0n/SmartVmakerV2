export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { harvests } from "@/src/lib/schema";
import { desc } from "drizzle-orm";

type SuccessResponse = {
  ok: true;
  harvests: Array<{
    id: string;
    query: string;
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
      .from(harvests)
      .orderBy(desc(harvests.createdAt))
      .limit(50);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      harvests: rows.map((row) => ({
        id: row.id,
        query: row.query,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching harvests:", error);
    return NextResponse.json<ErrorResponse>(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown database error",
      },
      { status: 500 }
    );
  }
}
