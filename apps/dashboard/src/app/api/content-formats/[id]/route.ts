import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ContentFormatConflictError, getContentFormatDetail, updateContentFormat } from "@/server/content-formats";
function fail(e: unknown) { if (e instanceof ZodError) return NextResponse.json({ error: "Invalid content format", details: e.flatten() }, { status: 400 }); if (e instanceof ContentFormatConflictError) return NextResponse.json({ error: e.message }, { status: e.message.includes("not found") ? 404 : 409 }); return NextResponse.json({ error: "Internal Server Error" }, { status: 500 }); }
export async function GET(request: Request, { params }: { params: { id: string } }) { try { return NextResponse.json(await getContentFormatDetail(params.id, { limit: new URL(request.url).searchParams.get("limit") ?? undefined })); } catch (e) { return fail(e); } }
export async function PATCH(request: Request, { params }: { params: { id: string } }) { try { return NextResponse.json(await updateContentFormat(params.id, await request.json())); } catch (e) { return fail(e); } }
