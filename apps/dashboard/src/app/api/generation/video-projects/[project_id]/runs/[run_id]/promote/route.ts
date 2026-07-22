import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  GenerationFoundationError,
  promoteGenerationRun,
} from "@/server/generation-runs";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { project_id: string; run_id: string } },
) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await promoteGenerationRun(userId, params.project_id, params.run_id),
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid generation run id" },
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
