import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  createGenerationRun,
  GenerationFoundationError,
  listGenerationRuns,
} from "@/server/generation-runs";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid generation run", details: error.flatten() },
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

export async function GET(
  request: Request,
  { params }: { params: { project_id: string } },
) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await listGenerationRuns(userId, params.project_id),
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: { project_id: string } },
) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await createGenerationRun(
        userId,
        params.project_id,
        await request.json(),
      ),
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
