import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateCandidate } from "@/server/seed-sources";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const candidate = await updateCandidate(params.id, await request.json());
    return candidate
      ? NextResponse.json(candidate)
      : NextResponse.json(
          { error: "Niche candidate not found" },
          { status: 404 },
        );
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
    console.error("Error updating niche candidate:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
