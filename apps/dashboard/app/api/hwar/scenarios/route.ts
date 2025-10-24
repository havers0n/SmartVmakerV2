import { NextRequest, NextResponse } from "next/server";
import { ScenarioCreate } from "@project/shared-types/hwar";
// import { db } from "@/src/lib/db"; // подключи свою drizzle инстанцию

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ScenarioCreate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.format() }, { status: 400 });
  }
  // const scenario = await db.insert(...).values(parsed.data).returning();
  const scenario = { id: "demo", ...parsed.data }; // заглушка до БД
  return NextResponse.json({ ok: true, scenario });
}
