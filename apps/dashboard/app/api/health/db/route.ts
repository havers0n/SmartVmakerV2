export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/src/lib/db";

type SuccessResponse = {
  ok: true;
  now: string;
  provider: "drizzle+pg";
};

type ErrorResponse = {
  ok: false;
  error: string;
};

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT now()`);
    const now = result.rows[0]?.now as string;

    return NextResponse.json<SuccessResponse>({
      ok: true,
      now,
      provider: "drizzle+pg",
    });
  } catch (error) {
    console.error("[Health] DB check failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json<ErrorResponse>(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Database connection failed",
      },
      { status: 500 }
    );
  }
}
