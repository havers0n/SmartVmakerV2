import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDiscoveryRun } from "@/server/discovery-runs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const run = await getDiscoveryRun(params.id);
    return run
      ? NextResponse.json(run)
      : NextResponse.json(
          { error: "Discovery run not found" },
          { status: 404 },
        );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
    console.error("Error loading discovery run:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
