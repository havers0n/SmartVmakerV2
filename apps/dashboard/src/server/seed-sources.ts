import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import {
  nicheCandidates,
  nicheQueries,
  niches,
  seedSources,
} from "@/shared/lib/schema";
export const entityIdSchema = z.string().uuid();
const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const createSeedSourceSchema = z
  .object({
    type: z.enum(["youtube_video", "youtube_channel", "manual"]),
    url: z.string().trim().url().max(2000).nullable().optional(),
    title: z.string().trim().min(1).max(300),
    notes: nullableText(5000),
  })
  .superRefine((value, ctx) => {
    if (value.type === "manual" && value.url)
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "Manual sources cannot have a URL",
      });
    if (value.type !== "manual" && !value.url)
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "URL is required",
      });
  });

export const updateSeedSourceSchema = z
  .object({
    url: z.string().trim().url().max(2000).nullable().optional(),
    title: z.string().trim().min(1).max(300).optional(),
    notes: nullableText(5000),
    status: z.enum(["new", "processed"]).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export const createCandidateSchema = z.object({
  seedSourceId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: nullableText(2000),
});

export const updateCandidateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: nullableText(2000),
    status: z.enum(["candidate", "rejected"]).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export async function createSeedSource(input: unknown) {
  const values = createSeedSourceSchema.parse(input);
  const [source] = await db
    .insert(seedSources)
    .values({ ...values, url: values.url ?? null, notes: values.notes ?? null })
    .returning();
  return source;
}

export function listSeedSources() {
  return db.select().from(seedSources).orderBy(asc(seedSources.createdAt));
}

export async function getSeedSource(id: string) {
  const validId = entityIdSchema.parse(id);
  const [source] = await db
    .select()
    .from(seedSources)
    .where(eq(seedSources.id, validId))
    .limit(1);
  if (!source) return null;
  const candidates = await db
    .select()
    .from(nicheCandidates)
    .where(eq(nicheCandidates.seedSourceId, validId))
    .orderBy(asc(nicheCandidates.createdAt));
  return { ...source, candidates };
}

export async function updateSeedSource(id: string, input: unknown) {
  const validId = entityIdSchema.parse(id);
  const values = updateSeedSourceSchema.parse(input);
  const [source] = await db
    .update(seedSources)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(seedSources.id, validId))
    .returning();
  return source ?? null;
}

export async function createCandidate(input: unknown) {
  const values = createCandidateSchema.parse(input);
  const [source] = await db
    .select({ id: seedSources.id })
    .from(seedSources)
    .where(eq(seedSources.id, values.seedSourceId))
    .limit(1);
  if (!source) return null;
  const [candidate] = await db
    .insert(nicheCandidates)
    .values({ ...values, description: values.description ?? null })
    .returning();
  return candidate;
}

export async function updateCandidate(id: string, input: unknown) {
  const validId = entityIdSchema.parse(id);
  const values = updateCandidateSchema.parse(input);
  const [candidate] = await db
    .update(nicheCandidates)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(nicheCandidates.id, validId))
    .returning();
  return candidate ?? null;
}

export function slugifyNiche(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function approveCandidate(id: string) {
  const validId = entityIdSchema.parse(id);
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(nicheCandidates)
      .where(eq(nicheCandidates.id, validId))
      .limit(1);
    if (!candidate) return null;
    if (candidate.status !== "candidate")
      throw new CandidateStateError(candidate.status);
    const slug = slugifyNiche(candidate.name);
    if (!slug) throw new InvalidCandidateNameError();
    const [niche] = await tx
      .insert(niches)
      .values({ name: candidate.name, slug })
      .returning();
    const [query] = await tx
      .insert(nicheQueries)
      .values({ nicheId: niche.id, query: candidate.name })
      .returning();
    const [approved] = await tx
      .update(nicheCandidates)
      .set({ status: "approved", updatedAt: new Date().toISOString() })
      .where(eq(nicheCandidates.id, validId))
      .returning();
    return { candidate: approved, niche, query };
  });
}

export class CandidateStateError extends Error {}
export class InvalidCandidateNameError extends Error {}
