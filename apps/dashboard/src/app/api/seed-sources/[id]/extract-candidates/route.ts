import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  EmptySourceContentError,
  extractCandidates,
  InvalidModelResponseError,
  NicheExtractionProviderError,
} from "@/server/seed-sources";

type Context = { params: { id: string } };

export async function POST(_request: Request, { params }: Context) {
  try {
    const result = await extractCandidates(params.id);
    return result
      ? NextResponse.json(result, { status: 201 })
      : NextResponse.json({ error: "Seed source not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid seed source id" },
        { status: 400 },
      );
    if (error instanceof EmptySourceContentError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof InvalidModelResponseError)
      return NextResponse.json({ error: error.message }, { status: 502 });
    if (error instanceof NicheExtractionProviderError)
      return NextResponse.json(
        { error: `AI candidate extraction failed: ${error.message}` },
        { status: 502 },
      );
    console.error("Error extracting niche candidates:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
