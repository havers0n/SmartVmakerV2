import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateNicheQuery } from "@/server/niches";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const query = await updateNicheQuery(params.id, await request.json());
    return query
      ? NextResponse.json(query)
      : NextResponse.json({ error: "Niche query not found" }, { status: 404 });
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
    console.error("Error updating niche query:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
