import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createCandidate } from "@/server/seed-sources";

export async function POST(request: Request) {
  try {
    const candidate = await createCandidate(await request.json());
    return candidate
      ? NextResponse.json(candidate, { status: 201 })
      : NextResponse.json({ error: "Seed source not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid niche candidate", details: error.errors },
        { status: 400 },
      );
    if ((error as { code?: string }).code === "23505")
      return NextResponse.json(
        { error: "A candidate with this name already exists for the source" },
        { status: 409 },
      );
    console.error("Error creating niche candidate:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
