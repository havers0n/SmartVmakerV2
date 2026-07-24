import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";
import {
  enqueueImageGeneration,
  getImageGenerationStatus,
  ImageGenerationError,
} from "@/server/image-generation";
import { GenerationFoundationError } from "@/server/generation-runs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string; run_id: string }> },
) {
  try {
    const userId = getTrustedUserId(request);
    if (!userId) return unauthorizedResponse();

    const { project_id, run_id } = await params;
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      return errorResponse(
        400,
        "MISSING_IDEMPOTENCY_KEY",
        "Idempotency-Key header is required",
      );
    }

    const body = await request.json().catch(() => ({}));

    const result = await enqueueImageGeneration(
      userId,
      project_id,
      run_id,
      body,
      idempotencyKey,
    );

    return NextResponse.json(result, {
      status: result.idempotentReplay ? 200 : 201,
    });
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
    console.error("[image-generation POST]", error);
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ project_id: string; run_id: string }> },
) {
  try {
    const userId = getTrustedUserId(request);
    if (!userId) return unauthorizedResponse();

    const { project_id, run_id } = await params;

    const result = await getImageGenerationStatus(userId, project_id, run_id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GenerationFoundationError) {
      return errorResponse(error.status, error.name, error.message);
    }
    console.error("[image-generation GET]", error);
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}
