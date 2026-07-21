import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  exportDiscoveryRunResearchCandidateCsv,
  getDiscoveryRun,
} from "@/server/discovery-runs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string; candidateId: string } },
) {
  try {
    if (!(await getDiscoveryRun(params.id)))
      return NextResponse.json(
        { error: "Discovery run not found" },
        { status: 404 },
      );

    const exportResult = await exportDiscoveryRunResearchCandidateCsv(
      params.id,
      params.candidateId,
    );
    if (!exportResult)
      return NextResponse.json(
        { error: "Research candidate not found" },
        { status: 404 },
      );

    return new NextResponse(exportResult.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    console.error("Error exporting research candidate CSV:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
