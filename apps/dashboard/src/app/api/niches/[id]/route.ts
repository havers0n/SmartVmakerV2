import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getNiche } from "@/server/niches";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const niche = await getNiche(params.id);
    return niche
      ? NextResponse.json(niche)
      : NextResponse.json({ error: "Niche not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid niche id" }, { status: 400 });
    console.error("Error getting niche:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
