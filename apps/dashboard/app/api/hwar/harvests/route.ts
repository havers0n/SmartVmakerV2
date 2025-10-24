import { NextResponse } from "next/server";
// import { db } from "@/src/lib/db";
export async function GET() {
  // const rows = await db.select().from(harvests).limit(50);
  const rows = []; // заглушка
  return NextResponse.json({ ok: true, harvests: rows });
}
