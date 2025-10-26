export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ScenarioCreate } from "@scrimspec/shared-types";
import { db } from "@/shared/lib/db";
import { scenarios } from "@/shared/lib/schema";
import { badRequest, serverError } from "@/shared/lib/http";

type SuccessResponse = {
  ok: true;
  scenario: {
    id: string;
    topic: string;
    durationSec: number;
    tags: string[];
    createdAt: Date;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ScenarioCreate.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.format());
    }

    const [scenario] = await db
      .insert(scenarios)
      .values({
        topic: parsed.data.topic,
        duration_sec: parsed.data.durationSec,
        tags: parsed.data.tags,
      })
      .returning();

    if (!scenario) {
      return serverError("Failed to create scenario");
    }

    return NextResponse.json<SuccessResponse>({
      ok: true,
      scenario: {
        id: scenario.id,
        topic: scenario.topic,
        durationSec: scenario.duration_sec,
        tags: scenario.tags as string[],
        createdAt: scenario.created_at,
      },
    });
  } catch (error) {
    console.error("[API] Error creating scenario:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}
