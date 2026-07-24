import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";
import { GenerationFoundationError } from "@/server/generation-runs";
import { approveScenarioCandidate, ScenarioApprovalError } from "@/server/scenario-approval";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: { project_id: string; run_id: string } }) {
  const userId = getTrustedUserId(request); if (!userId) return unauthorizedResponse();
  const key = request.headers.get("Idempotency-Key");
  if (!key) return NextResponse.json({ code: "IDEMPOTENCY_KEY_REQUIRED", error: "Idempotency-Key is required" }, { status: 400 });
  try { const result = await approveScenarioCandidate(userId, params.project_id, params.run_id, await request.json(), key); return NextResponse.json(result, { status: result.idempotentReplay ? 200 : 201 }); }
  catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ code: "INVALID_SCENARIO_APPROVAL_REQUEST", error: "Invalid approval request" }, { status: 400 });
    if (error instanceof ScenarioApprovalError || error instanceof GenerationFoundationError) return NextResponse.json({ code: error instanceof ScenarioApprovalError ? error.code : "GENERATION_RUN_ERROR", error: error.message }, { status: error.status });
    return NextResponse.json({ code: "INTERNAL_SERVER_ERROR", error: "Internal Server Error" }, { status: 500 });
  }
}
