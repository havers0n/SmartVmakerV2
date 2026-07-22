import { NextResponse } from "next/server";
import {
  activateContentFormat,
  ContentFormatConflictError,
  ContentFormatNotFoundError,
} from "@/server/content-formats";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await activateContentFormat(params.id));
  } catch (error) {
    if (error instanceof ContentFormatNotFoundError)
      return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof ContentFormatConflictError)
      return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
