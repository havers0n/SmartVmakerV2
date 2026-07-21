import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  generateNicheQueries,
  InvalidQueryGenerationResponseError,
  QueryGenerationProviderError,
} from "@/server/niches";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await generateNicheQueries(params.id);
    return result
      ? NextResponse.json(result, { status: 201 })
      : NextResponse.json({ error: "Niche not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid niche id" }, { status: 400 });
    if (
      error instanceof InvalidQueryGenerationResponseError ||
      error instanceof QueryGenerationProviderError
    )
      return NextResponse.json({ error: error.message }, { status: 502 });
    console.error("Error generating niche queries:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
