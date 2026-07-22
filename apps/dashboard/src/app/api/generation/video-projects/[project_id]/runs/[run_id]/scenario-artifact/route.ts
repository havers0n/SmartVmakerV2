import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getValidatedScenarioArtifact,
  ScenarioArtifactReadError,
} from "@/server/scenario-execution";
import { GenerationFoundationError } from "@/server/generation-runs";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { project_id: string; run_id: string } },
) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await getValidatedScenarioArtifact(
        userId,
        params.project_id,
        params.run_id,
      ),
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          code: "INVALID_SCENARIO_ARTIFACT_REQUEST",
          error: "Invalid run identifier",
        },
        { status: 400 },
      );
    }
    if (error instanceof ScenarioArtifactReadError) {
      return NextResponse.json(
        { code: error.code, error: error.message },
        { status: error.status },
      );
    }
    if (error instanceof GenerationFoundationError) {
      return NextResponse.json(
        { code: "GENERATION_RUN_NOT_FOUND", error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { code: "INTERNAL_SERVER_ERROR", error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
