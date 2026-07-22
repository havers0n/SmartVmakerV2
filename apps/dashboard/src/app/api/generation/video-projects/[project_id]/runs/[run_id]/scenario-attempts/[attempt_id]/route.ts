import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getScenarioAttempt } from "@/server/scenario-execution";
import { GenerationFoundationError } from "@/server/generation-runs";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";

export const runtime = "nodejs";

type Context = {
  params: { project_id: string; run_id: string; attempt_id: string };
};

export async function GET(request: Request, { params }: Context) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await getScenarioAttempt(
        userId,
        params.project_id,
        params.run_id,
        params.attempt_id,
      ),
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid scenario attempt identifier" },
        { status: 400 },
      );
    }
    if (error instanceof GenerationFoundationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
