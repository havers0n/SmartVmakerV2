import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createBulkNicheQueries, getNiche } from "@/server/niches";

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await getNiche(params.id)))
      return NextResponse.json({ error: "Niche not found" }, { status: 404 });

    const body = await request.json();
    if (!body.queries || !Array.isArray(body.queries)) {
      return NextResponse.json(
        { error: "Body must contain a 'queries' array" },
        { status: 400 },
      );
    }

    const result = await createBulkNicheQueries(params.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid niche id", details: error.errors },
        { status: 400 },
      );
    if ((error as { code?: string }).code === "23505")
      return NextResponse.json(
        { error: "One or more queries already exist for the niche" },
        { status: 409 },
      );
    console.error("Error creating bulk niche queries:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
