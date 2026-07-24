import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";
import {
  retryImageAttempt,
  ImageGenerationError,
} from "@/server/image-generation";
import { GenerationFoundationError } from "@/server/generation-runs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ project_id: string; run_id: string; attempt_id: string }>;
  },
) {
  try {
    const userId = getTrustedUserId(request);
    if (!userId) return unauthorizedResponse();

    const { project_id, run_id, attempt_id } = await params;
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      return errorResponse(
        400,
        "MISSING_IDEMPOTENCY_KEY",
        "Idempotency-Key header is required",
      );
    }

    const result = await retryImageAttempt(
      userId,
      project_id,
      run_id,
      attempt_id,
      idempotencyKey,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ImageGenerationError) {
      return errorResponse(error.status, error.code, error.message);
    }
    if (error instanceof GenerationFoundationError) {
      return errorResponse(error.status, error.name, error.message);
    }
    if (error instanceof z.ZodError) {
      return errorResponse(
        400,
        "VALIDATION_ERROR",
        error.issues[0]?.message ?? "Invalid input",
      );
    }
    console.error("[image-attempt retry POST]", error);
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}
