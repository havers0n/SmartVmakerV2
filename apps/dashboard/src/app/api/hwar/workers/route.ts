export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hwar_workers } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { serverError } from "@/lib/http";
import { z } from "zod";

type SuccessResponse = {
  ok: true;
  workers: Array<{
    id: string;
    name: string;
    status: string;
    updatedAt: Date;
  }>;
};

type WorkerUpdateResponse = {
  ok: true;
  worker: {
    id: string;
    name: string;
    status: string;
    updatedAt: Date;
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
      .from(hwar_workers)
      .orderBy(desc(hwar_workers.updatedAt))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      workers: rows.map((row: typeof hwar_workers.$inferSelect) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching workers:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}

const UpdateWorkerSchema = z.object({
  status: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = z.object({ id: z.string() }).parse(params);
    const body = await request.json();
    const { status } = UpdateWorkerSchema.parse(body);

    if (!status) {
      return NextResponse.json<ErrorResponse>(
        { ok: false, error: "Status is required" },
        { status: 400 }
      );
    }

    const rows = await db
      .update(hwar_workers)
      .set({ status, updatedAt: new Date() })
      .where(eq(hwar_workers.id, id))
      .returning();

    if (rows.length === 0) {
      return NextResponse.json<ErrorResponse>(
        { ok: false, error: "Worker not found" },
        { status: 404 }
      );
    }

    const worker = rows[0];
    
    return NextResponse.json<WorkerUpdateResponse>({
      ok: true,
      worker: {
        id: worker.id,
        name: worker.name,
        status: worker.status,
        updatedAt: worker.updatedAt,
      },
    });
  } catch (error) {
    console.error("[API] Error updating worker:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}