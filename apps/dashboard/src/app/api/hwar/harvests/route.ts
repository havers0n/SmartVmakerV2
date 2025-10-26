export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/shared/lib/db";
import { harvests } from "@/shared/lib/schema";
import { desc } from "drizzle-orm";
import { serverError } from "@/shared/lib/http";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';

type SuccessResponse = {
  ok: true;
  harvests: Array<{
    id: string;
    query: string;
    createdAt: Date;
  }>;
};

type HarvestCreateResponse = {
  ok: true;
  harvest: {
    id: string;
    query: string;
    createdAt: Date;
  };
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(harvests)
      .orderBy(desc(harvests.created_at))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      harvests: rows.map((row: typeof harvests.$inferSelect) => ({
        id: row.id,
        query: row.query,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching harvests:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}

const CreateHarvestSchema = z.object({
  query: z.string().min(1),
  lang: z.string().optional(),
  limit: z.number().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = CreateHarvestSchema.parse(body);

    const rows = await db
      .insert(harvests)
      .values({
        id: uuidv4(),
        query,
        created_at: new Date(),
      })
      .returning();

    const harvest = rows[0];

    return NextResponse.json<HarvestCreateResponse>({
      ok: true,
      harvest: {
        id: harvest.id,
        query: harvest.query,
        createdAt: harvest.created_at,
      },
    });
  } catch (error) {
    console.error("[API] Error creating harvest:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}