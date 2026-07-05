import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSeedSource, listSeedSources } from "@/server/seed-sources";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listSeedSources());
  } catch (error) {
    console.error("Error listing seed sources:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(await createSeedSource(await request.json()), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid seed source", details: error.errors },
        { status: 400 },
      );
    console.error("Error creating seed source:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
