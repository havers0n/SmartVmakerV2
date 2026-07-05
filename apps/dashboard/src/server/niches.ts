import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import { nicheQueries, niches } from "@/shared/lib/schema";

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
