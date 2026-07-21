import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createContentFormat, listContentFormats } from "@/server/content-formats";
const fail = (e: unknown) => e instanceof ZodError ? NextResponse.json({ error: "Invalid content format", details: e.flatten() }, { status: 400 }) : NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
export async function GET(request: Request) { try { const q = new URL(request.url).searchParams; return NextResponse.json(await listContentFormats({ status: q.get("status") ?? undefined, search: q.get("search") ?? undefined, limit: q.get("limit") ?? undefined })); } catch (e) { return fail(e); } }
export async function POST(request: Request) { try { return NextResponse.json(await createContentFormat(await request.json()), { status: 201 }); } catch (e) { return fail(e); } }
