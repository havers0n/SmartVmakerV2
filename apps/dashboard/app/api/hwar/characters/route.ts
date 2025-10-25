export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { hwar_characters } from "@/src/lib/schema";
import { desc } from "drizzle-orm";
import { serverError } from "@/src/lib/http";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';

type SuccessResponse = {
  ok: true;
  characters: Array<{
    id: string;
    name: string;
    meta: Record<string, any>;
    createdAt: Date;
  }>;
};

type CharacterCreateResponse = {
  ok: true;
  character: {
    id: string;
    name: string;
    meta: Record<string, any>;
    createdAt: Date;
  };
};

type ErrorResponse = {
  ok: false;
  error: string;
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(hwar_characters)
      .orderBy(desc(hwar_characters.createdAt))
      .limit(100);

    return NextResponse.json<SuccessResponse>({
      ok: true,
      characters: rows.map((row: typeof hwar_characters.$inferSelect) => ({
        id: row.id,
        name: row.name,
        meta: row.meta || {},
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching characters:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}

const CreateCharacterSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  referenceImages: z.array(z.string()).optional(),
  styleRules: z.string().optional(),
  tags: z.array(z.string()).optional(),
  meta: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, referenceImages, styleRules, tags, meta } = CreateCharacterSchema.parse(body);

    // Merge all properties into meta
    const characterMeta = {
      ...(meta || {}),
      ...(description && { description }),
      ...(referenceImages && { referenceImages }),
      ...(styleRules && { styleRules }),
      ...(tags && { tags }),
    };

    const rows = await db
      .insert(hwar_characters)
      .values({
        id: uuidv4(),
        name,
        meta: characterMeta,
        createdAt: new Date(),
      })
      .returning();

    const character = rows[0];
    
    return NextResponse.json<CharacterCreateResponse>({
      ok: true,
      character: {
        id: character.id,
        name: character.name,
        meta: character.meta || {},
        createdAt: character.createdAt,
      },
    });
  } catch (error) {
    console.error("[API] Error creating character:", error instanceof Error ? error.message : "Unknown error");
    return serverError(error);
  }
}