export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hwar_templates } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { serverError } from "@/lib/http";

type SuccessResponse = {
  ok: true;
  templates: Array<{
    id: string;
    name: string;
    meta: Record<string, any>;
    createdAt: Date;
  }>;
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(hwar_templates)
      .orderBy(desc(hwar_templates.createdAt))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      templates: rows.map((row: typeof hwar_templates.$inferSelect) => ({
        id: row.id,
        name: row.name,
        meta: row.meta || {},
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching templates:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}