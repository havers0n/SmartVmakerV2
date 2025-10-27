export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { hwar_datasets } from "@/shared/lib/schema";
import { desc } from "drizzle-orm";
import { serverError } from "@/shared/lib/http";

type SuccessResponse = {
  ok: true;
  datasets: Array<{
    id: string;
    name: string;
    createdAt: Date;
  }>;
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(hwar_datasets)
      .orderBy(desc(hwar_datasets.created_at))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      datasets: rows.map((row: typeof hwar_datasets.$inferSelect) => ({
        id: row.id,
        name: row.name,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching datasets:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}