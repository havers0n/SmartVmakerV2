export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ScenarioCreate } from "@scrimspec/shared-types/hwar";
import { db } from "@/src/lib/db";
import { scenarios } from "@/src/lib/schema";

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

type ErrorResponse = {
  ok: false;
  error: string | Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ScenarioCreate.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json<ErrorResponse>(
        { ok: false, error: parsed.error.format() },
        { status: 400 }
      );
    }

    const [scenario] = await db
      .insert(scenarios)
      .values({
        topic: parsed.data.topic,
        durationSec: parsed.data.durationSec,
        tags: parsed.data.tags,
      })
      .returning();

    if (!scenario) {
      return NextResponse.json<ErrorResponse>(
        { ok: false, error: "Failed to create scenario" },
        { status: 500 }
      );
    }

    return NextResponse.json<SuccessResponse>({
      ok: true,
      scenario: {
        id: scenario.id,
        topic: scenario.topic,
        durationSec: scenario.durationSec,
        tags: scenario.tags as string[],
        createdAt: scenario.createdAt,
      },
    });
  } catch (error) {
    console.error("[API] Error creating scenario:", error);
    return NextResponse.json<ErrorResponse>(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown database error",
      },
      { status: 500 }
    );
  }
}
