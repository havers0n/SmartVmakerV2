export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { serverError } from "@/lib/http";

type SuccessResponse = {
  ok: true;
  now: string;
  provider: "drizzle+pg";
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
    return serverError(error);
  }
}
