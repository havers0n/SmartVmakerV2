import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getDiscoveryRun,
  listDiscoveryRunResearchCandidates,
} from "@/server/discovery-runs";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await getDiscoveryRun(params.id)))
      return NextResponse.json(
        { error: "Discovery run not found" },
        { status: 404 },
      );
    const includeMultilingual =
      new URL(request.url).searchParams.get("includeMultilingual") === "true";
    return NextResponse.json(
      await listDiscoveryRunResearchCandidates(params.id, {
        includeMultilingual,
      }),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
    console.error("Error loading research candidates:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
