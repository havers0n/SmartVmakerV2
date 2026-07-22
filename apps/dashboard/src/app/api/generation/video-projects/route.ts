import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  createVideoProject,
  GenerationFoundationError,
  listVideoProjects,
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

export async function GET(request: Request) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(await listVideoProjects(userId));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const userId = getTrustedUserId(request);
  if (!userId) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await createVideoProject(userId, await request.json()),
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
