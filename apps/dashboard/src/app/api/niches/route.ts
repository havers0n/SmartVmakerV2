import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createNiche, listNiches } from "@/server/niches";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listNiches());
  } catch (error) {
    console.error("Error listing niches:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(await createNiche(await request.json()), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid niche", details: error.errors },
        { status: 400 },
      );
    if ((error as { code?: string }).code === "23505")
      return NextResponse.json(
        { error: "A niche with this slug already exists" },
        { status: 409 },
      );
    console.error("Error creating niche:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
