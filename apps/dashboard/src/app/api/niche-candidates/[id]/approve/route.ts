import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  approveCandidate,
  CandidateStateError,
  InvalidCandidateNameError,
} from "@/server/seed-sources";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await approveCandidate(params.id);
    return result
      ? NextResponse.json(result)
      : NextResponse.json(
          { error: "Niche candidate not found" },
          { status: 404 },
        );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid niche candidate id" },
        { status: 400 },
      );
    if (error instanceof CandidateStateError)
      return NextResponse.json(
        {
          error: `Only candidate records can be approved (current status: ${error.message})`,
        },
        { status: 409 },
      );
    if (error instanceof InvalidCandidateNameError)
      return NextResponse.json(
        { error: "Candidate name cannot produce a valid niche slug" },
        { status: 400 },
      );
    if ((error as { code?: string }).code === "23505")
      return NextResponse.json(
        { error: "A niche with this slug already exists" },
        { status: 409 },
      );
    console.error("Error approving niche candidate:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
