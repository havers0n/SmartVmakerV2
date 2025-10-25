export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hwar_presets } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { serverError } from "@/lib/http";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';

type SuccessResponse = {
  ok: true;
  presets: Array<{
    id: string;
    name: string;
    meta: Record<string, any>;
    createdAt: Date;
  }>;
};

type PresetCreateResponse = {
  ok: true;
  preset: {
    id: string;
    name: string;
    meta: Record<string, any>;
    createdAt: Date;
  };
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(hwar_presets)
      .orderBy(desc(hwar_presets.createdAt))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      presets: rows.map((row: typeof hwar_presets.$inferSelect) => ({
        id: row.id,
        name: row.name,
        meta: row.meta || {},
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching presets:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}

const CreatePresetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  theme: z.string().optional(),
  emotions: z.array(z.string()).optional(),
  examplePrompt: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, theme, emotions, examplePrompt, meta } = CreatePresetSchema.parse(body);

    // Merge all properties into meta
    const presetMeta = {
      ...(meta || {}),
      ...(description && { description }),
      ...(theme && { theme }),
      ...(emotions && { emotions }),
      ...(examplePrompt && { examplePrompt }),
    };

    const rows = await db
      .insert(hwar_presets)
      .values({
        id: uuidv4(),
        name,
        meta: presetMeta,
        createdAt: new Date(),
      })
      .returning();

    const preset = rows[0];
    
    return NextResponse.json<PresetCreateResponse>({
      ok: true,
      preset: {
        id: preset.id,
        name: preset.name,
        meta: preset.meta || {},
        createdAt: preset.createdAt,
      },
    });
  } catch (error) {
    console.error("[API] Error creating preset:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}