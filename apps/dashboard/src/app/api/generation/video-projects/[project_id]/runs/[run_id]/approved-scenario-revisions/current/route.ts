import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";
import { GenerationFoundationError } from "@/server/generation-runs";
import { getCurrentApprovedScenarioRevision } from "@/server/scenario-approval";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: { project_id: string; run_id: string } },
) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await getCurrentApprovedScenarioRevision(
        userId,
        params.project_id,
        params.run_id,
      ),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          code: "INVALID_SCENARIO_APPROVAL_REQUEST",
          error: "Invalid run identifier",
        },
        { status: 400 },
      );
    if (error instanceof GenerationFoundationError)
      return NextResponse.json(
        { code: "GENERATION_RUN_ERROR", error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { code: "INTERNAL_SERVER_ERROR", error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
