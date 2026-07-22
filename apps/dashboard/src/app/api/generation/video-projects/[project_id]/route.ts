import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  GenerationFoundationError,
  getVideoProject,
  updateVideoProject,
} from "@/server/generation-runs";
import { getTrustedUserId, unauthorizedResponse } from "@/shared/lib/auth";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid video project", details: error.flatten() },
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
    return NextResponse.json(await getVideoProject(userId, params.project_id));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { project_id: string } },
) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await updateVideoProject(userId, params.project_id, await request.json()),
    );
  } catch (error) {
    return failure(error);
  }
}
