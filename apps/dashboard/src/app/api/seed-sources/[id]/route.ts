import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSeedSource, updateSeedSource } from "@/server/seed-sources";

type Context = { params: { id: string } };

export async function GET(_request: Request, { params }: Context) {
  try {
    const source = await getSeedSource(params.id);
    return source
      ? NextResponse.json(source)
      : NextResponse.json({ error: "Seed source not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid seed source id" },
        { status: 400 },
      );
    console.error("Error getting seed source:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const source = await updateSeedSource(params.id, await request.json());
    return source
      ? NextResponse.json(source)
      : NextResponse.json({ error: "Seed source not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid seed source", details: error.errors },
        { status: 400 },
      );
    console.error("Error updating seed source:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
