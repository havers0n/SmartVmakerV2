import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import { nicheQueries, niches } from "@/shared/lib/schema";
import {
  nicheQueryGenerationProvider,
  type NicheQueryGenerationProvider,
} from "./niche-query-generation-provider";

export const nicheIdSchema = z.string().uuid();

export const createNicheSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase URL slug"),
  language: z.string().trim().min(2).max(10).default("en"),
  maxChannelAgeMonths: z.coerce.number().int().min(1).max(120).default(24),
});

export const createNicheQuerySchema = z.object({
  query: z.string().trim().min(1).max(300),
  isEnabled: z.boolean().default(true),
});

export const updateNicheQuerySchema = z
  .object({
    query: z.string().trim().min(1).max(300).optional(),
    isEnabled: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export async function listNiches() {
  return db.select().from(niches).orderBy(asc(niches.name));
}

export async function getNiche(id: string) {
  const validId = nicheIdSchema.parse(id);
  const [niche] = await db
    .select()
    .from(niches)
    .where(eq(niches.id, validId))
    .limit(1);
  return niche ?? null;
}

export async function createNiche(input: unknown) {
  const values = createNicheSchema.parse(input);
  const [niche] = await db.insert(niches).values(values).returning();
  return niche;
}

export async function listNicheQueries(nicheId: string) {
  const validId = nicheIdSchema.parse(nicheId);
  return db
    .select()
    .from(nicheQueries)
    .where(eq(nicheQueries.nicheId, validId))
    .orderBy(asc(nicheQueries.createdAt));
}

export async function createNicheQuery(nicheId: string, input: unknown) {
  const validNicheId = nicheIdSchema.parse(nicheId);
  const values = createNicheQuerySchema.parse(input);
  const [query] = await db
    .insert(nicheQueries)
    .values({ ...values, nicheId: validNicheId })
    .returning();
  return query;
}

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function validateQuery(query: string): { valid: true } | { valid: false; reason: string } {
  if (query.length < 2) return { valid: false, reason: "Query too short (min 2 chars)" };
  if (query.length > 200) return { valid: false, reason: "Query too long (max 200 chars)" };
  return { valid: true };
}

export function parseBulkQueries(
  input: string,
  existingQueries: string[],
  maxBulkSize = 100,
): {
  queries: string[];
  skippedDuplicates: string[];
  skippedEmpty: number;
  errors: Array<{ query: string; reason: string }>;
} {
  const lines = input.split(/\n/);
  const seen = new Set<string>();
  const existingLower = new Set(
    existingQueries.map((q) => q.trim().toLowerCase()),
  );
  const queries: string[] = [];
  const skippedDuplicates: string[] = [];
  let skippedEmpty = 0;
  const errors: Array<{ query: string; reason: string }> = [];

  for (const line of lines) {
    const trimmed = normalizeQuery(line);
    if (!trimmed) {
      skippedEmpty++;
      continue;
    }

    const validation = validateQuery(trimmed);
    if (!validation.valid) {
      errors.push({ query: trimmed, reason: validation.reason });
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key) || existingLower.has(key)) {
      skippedDuplicates.push(trimmed);
      continue;
    }

    if (queries.length >= maxBulkSize) {
      errors.push({
        query: trimmed,
        reason: "Batch size limit reached (max 100)",
      });
      continue;
    }

    seen.add(key);
    queries.push(trimmed);
  }

  return { queries, skippedDuplicates, skippedEmpty, errors };
}

export async function createBulkNicheQueries(
  nicheId: string,
  input: { queries: string[] },
) {
  const validNicheId = nicheIdSchema.parse(nicheId);
  const existing = await listNicheQueries(validNicheId);
  const parsed = parseBulkQueries(
    input.queries.join("\n"),
    existing.map((q) => q.query),
  );

  const added: (typeof nicheQueries.$inferSelect)[] = [];
  for (const query of parsed.queries) {
    const [saved] = await db
      .insert(nicheQueries)
      .values({ query, nicheId: validNicheId })
      .returning();
    added.push(saved);
  }

  return {
    added,
    skippedDuplicates: parsed.skippedDuplicates,
    skippedEmpty: parsed.skippedEmpty,
    errors: parsed.errors,
  };
}

export async function updateNicheQuery(id: string, input: unknown) {
  const validId = nicheIdSchema.parse(id);
  const values = updateNicheQuerySchema.parse(input);
  const [query] = await db
    .update(nicheQueries)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(nicheQueries.id, validId))
    .returning();
  return query ?? null;
}

const querySuggestionSchema = z.object({
  query: z.string().trim().min(1).max(300),
  reason: z.string().trim().optional(),
  type: z
    .enum(["core", "synonym", "format", "shorts", "long_form", "adjacent"])
    .optional(),
});
const queryGenerationResponseSchema = z.union([
  z.array(querySuggestionSchema).min(5).max(12),
  z
    .object({ queries: z.array(querySuggestionSchema).min(5).max(12) })
    .transform((value) => value.queries),
]);

export type QuerySuggestion = z.infer<typeof querySuggestionSchema>;
export class InvalidQueryGenerationResponseError extends Error {}
export class QueryGenerationProviderError extends Error {}

export function buildNicheQueryGenerationPrompt(input: {
  name: string;
  description?: string | null;
  existingQueries?: string[];
}) {
  return `Generate YouTube search queries for this niche. These must be phrases a user would search on YouTube, not SEO keywords or content ideas.

Return JSON only as {"queries":[{"query":"...","reason":"...","type":"core"}]}.
Generate 5-12 concrete queries: 1-2 core, 2-4 synonym/variant, 1-2 shorts-oriented, 1-2 long-form-oriented, and 1-2 adjacent but relevant queries.
Allowed types: core, synonym, format, shorts, long_form, adjacent.
Avoid unrelated broad categories and duplicate meanings.

Good: AI tools for students; best AI study tools; AI tools shorts; how students use AI; AI note taking tools.
Bad: AI; Technology; Education; Students; Productivity; Viral videos; Content ideas.

Niche: ${input.name}
Description: ${input.description ?? ""}
Existing queries (do not repeat): ${(input.existingQueries ?? []).join("; ")}`;
}

export function parseQuerySuggestions(raw: string): QuerySuggestion[] {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    return queryGenerationResponseSchema.parse(
      JSON.parse((fenced ?? raw).trim()),
    );
  } catch {
    throw new InvalidQueryGenerationResponseError(
      "The AI provider returned invalid query JSON",
    );
  }
}

export async function generateNicheQueries(
  id: string,
  provider: NicheQueryGenerationProvider = nicheQueryGenerationProvider,
  description?: string | null,
) {
  const niche = await getNiche(id);
  if (!niche) return null;
  const existing = await listNicheQueries(id);
  let raw: string;
  try {
    raw = await provider.generate(
      buildNicheQueryGenerationPrompt({
        name: niche.name,
        description,
        existingQueries: existing.map((item) => item.query),
      }),
    );
  } catch (error) {
    throw new QueryGenerationProviderError(
      error instanceof Error ? error.message : "AI provider failed",
    );
  }
  const suggestions = parseQuerySuggestions(raw);
  const seen = new Set(
    existing.map((item) => item.query.trim().toLocaleLowerCase()),
  );
  const created: (typeof nicheQueries.$inferSelect)[] = [];
  const skipped: QuerySuggestion[] = [];
  for (const suggestion of suggestions) {
    const key = suggestion.query.trim().toLocaleLowerCase();
    if (seen.has(key)) {
      skipped.push(suggestion);
      continue;
    }
    seen.add(key);
    const [saved] = await db
      .insert(nicheQueries)
      .values({ nicheId: niche.id, query: suggestion.query })
      .returning();
    created.push(saved);
  }
  return { created, skipped };
}
