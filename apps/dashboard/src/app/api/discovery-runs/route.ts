import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  createDiscoveryRun,
  DiscoveryRunError,
  listDiscoveryRuns,
} from "@/server/discovery-runs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const nicheId = new URL(request.url).searchParams.get("nicheId");
    if (!nicheId)
      return NextResponse.json(
        { error: "nicheId is required" },
        { status: 400 },
      );
    return NextResponse.json(await listDiscoveryRuns(nicheId));
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid nicheId", details: error.errors },
        { status: 400 },
      );
    console.error("Error listing discovery runs:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(await createDiscoveryRun(await request.json(), request.headers.get("idempotency-key")), {
      status: 202,
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Invalid discovery run", details: error.errors },
        { status: 400 },
      );
    if (error instanceof DiscoveryRunError)
      return NextResponse.json(
        { error: error.message, runId: error.runId },
        { status: 502 },
      );
    if (
      error instanceof Error &&
      (error.message === "Niche not found" ||
        error.message.includes("no enabled"))
    )
      return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Error creating discovery run:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
