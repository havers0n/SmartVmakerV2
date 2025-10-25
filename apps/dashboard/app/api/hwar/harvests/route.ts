export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { harvests } from "@/src/lib/schema";
import { desc, eq } from "drizzle-orm";
import { serverError } from "@/src/lib/http";
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
      .limit(100);

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
        createdAt: new Date(),
      })
      .returning();

    const harvest = rows[0];
    
    return NextResponse.json<HarvestCreateResponse>({
      ok: true,
      harvest: {
        id: harvest.id,
        query: harvest.query,
        createdAt: harvest.createdAt,
      },
    });
  } catch (error) {
    console.error("[API] Error creating harvest:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}

export async function GET_BY_ID(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = z.object({ id: z.string() }).parse(params);
    
    const rows = await db
      .select()
      .from(harvests)
      .where(eq(harvests.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json<ErrorResponse>(
        { ok: false, error: "Harvest not found" },
        { status: 404 }
      );
    }

    const harvest = rows[0];
    
    return NextResponse.json<SuccessResponse>({
      ok: true,
      harvests: [{
        id: harvest.id,
        query: harvest.query,
        createdAt: harvest.createdAt,
      }],
    });
  } catch (error) {
    console.error("[API] Error fetching harvest:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}