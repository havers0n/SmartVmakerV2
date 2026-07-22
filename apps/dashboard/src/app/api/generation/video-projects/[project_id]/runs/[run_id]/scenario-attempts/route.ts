import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  enqueueScenarioGenerationAttempt,
  getScenarioExecution,
} from "@/server/scenario-execution";
import { GenerationFoundationError } from "@/server/generation-runs";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid scenario attempt request", details: error.flatten() },
      { status: 400 },
    );
  }
  if (error instanceof GenerationFoundationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

type Context = { params: { project_id: string; run_id: string } };

export async function GET(request: Request, { params }: Context) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await getScenarioExecution(userId, params.project_id, params.run_id),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "Idempotency-Key header is required" },
      { status: 400 },
    );
  }
  try {
    const result = await enqueueScenarioGenerationAttempt(
      userId,
      params.project_id,
      params.run_id,
      idempotencyKey,
    );
    return NextResponse.json(result, {
      status: result.idempotentReplay ? 200 : 202,
    });
  } catch (error) {
    return failure(error);
  }
}
