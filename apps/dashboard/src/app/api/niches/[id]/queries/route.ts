import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createNicheQuery, getNiche, listNicheQueries } from "@/server/niches";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await getNiche(params.id)))
      return NextResponse.json({ error: "Niche not found" }, { status: 404 });
    return NextResponse.json(await listNicheQueries(params.id));
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid niche id" }, { status: 400 });
    console.error("Error listing niche queries:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await getNiche(params.id)))
      return NextResponse.json({ error: "Niche not found" }, { status: 404 });
    return NextResponse.json(
      await createNicheQuery(params.id, await request.json()),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid niche query", details: error.errors },
        { status: 400 },
      );
    if ((error as { code?: string }).code === "23505")
      return NextResponse.json(
        { error: "This query already exists for the niche" },
        { status: 409 },
      );
    console.error("Error creating niche query:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
