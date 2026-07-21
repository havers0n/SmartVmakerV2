import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  analyzeDiscoveryRunOpportunity,
  getDiscoveryRun,
} from "@/server/discovery-runs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await getDiscoveryRun(params.id)))
      return NextResponse.json(
        { error: "Discovery run not found" },
        { status: 404 },
      );
    return NextResponse.json(
      await analyzeDiscoveryRunOpportunity(params.id),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
    console.error("Error analyzing discovery run:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
