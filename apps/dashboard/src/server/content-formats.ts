import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  contentFormatInputSchema,
  contentFormatProductionDefaultsSchema,
  contentFormatProductionRulesSchema,
} from "@scrimspec/shared-types";
import { db } from "@/shared/lib/db";
import {
  contentFormatChannels,
  contentFormatEvidence,
  contentFormatVideos,
  contentFormats,
  discoveryRuns,
  videoDiscoveries,
  youtubeChannels,
  youtubeVideos,
} from "@/shared/lib/schema";

const uuid = z.string().uuid();
const confidence = z.number().min(0).max(1).nullable().optional();
const shortText = z.string().trim().max(10_000).nullable().optional();
export const formatStatusSchema = z.enum(["draft", "active", "archived"]);
export const formatTypeSchema = z.enum(["long_form", "short_form", "mixed"]);
export const videoRoleSchema = z.enum([
  "exemplar",
  "supporting",
  "counterexample",
]);
export const channelRoleSchema = z.enum([
  "primary",
  "frequent",
  "occasional",
  "reference",
]);
export const associationSourceSchema = z.enum(["manual", "discovery"]);
export const evidenceTypeSchema = z.enum([
  "title_pattern",
  "thumbnail_pattern",
  "hook",
  "structure",
  "visual_style",
  "pacing",
  "audience_promise",
  "topic_independence",
  "performance",
  "other",
]);
export const evidenceSourceSchema = z.enum(["manual", "metadata", "discovery"]);
const provenanceSchema = z
  .object({
    discoveryRunId: uuid.optional(),
    discoveryStepId: uuid.optional(),
    clusterId: uuid.optional(),
    videoDiscoveryId: z.string().max(200).optional(),
    sourceField: z
      .enum(["title", "thumbnail", "metadata", "cluster", "manual"])
      .optional(),
  })
  .strict()
  .optional()
  .superRefine((value, ctx) => {
    if (value && Buffer.byteLength(JSON.stringify(value), "utf8") > 2048)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provenance is too large",
      });
  });

const durationFields = {
  targetDurationMinSeconds: z.number().int().min(0).nullable().optional(),
  targetDurationMaxSeconds: z.number().int().min(0).nullable().optional(),
};
const contentFormatFields = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: shortText,
    formatType: formatTypeSchema.default("mixed"),
    hookPattern: shortText,
    structurePattern: shortText,
    visualPattern: shortText,
    pacingPattern: shortText,
    notes: shortText,
    exampleOutput: shortText,
    inputSchema: contentFormatInputSchema.optional(),
    productionDefaults: contentFormatProductionDefaultsSchema.optional(),
    productionRules: contentFormatProductionRulesSchema.optional(),
    ...durationFields,
  })
  .strict();
function validateContentFormatDefaults(
  value: Partial<z.infer<typeof contentFormatFields>>,
  ctx: z.RefinementCtx,
) {
  const duration = value.productionDefaults?.targetDurationSeconds;
  if (
    duration != null &&
    value.targetDurationMinSeconds != null &&
    duration < value.targetDurationMinSeconds
  )
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["productionDefaults", "targetDurationSeconds"],
      message: "Default duration is below the Content Format minimum",
    });
  if (
    duration != null &&
    value.targetDurationMaxSeconds != null &&
    duration > value.targetDurationMaxSeconds
  )
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["productionDefaults", "targetDurationSeconds"],
      message: "Default duration exceeds the Content Format maximum",
    });
}
export const createContentFormatSchema = contentFormatFields
  .refine(
    (v) =>
      v.targetDurationMinSeconds == null ||
      v.targetDurationMaxSeconds == null ||
      v.targetDurationMinSeconds <= v.targetDurationMaxSeconds,
    {
      message: "Minimum duration cannot exceed maximum duration",
      path: ["targetDurationMinSeconds"],
    },
  )
  .superRefine(validateContentFormatDefaults);
export const updateContentFormatSchema = contentFormatFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, "At least one field is required")
  .refine(
    (v) =>
      v.targetDurationMinSeconds == null ||
      v.targetDurationMaxSeconds == null ||
      v.targetDurationMinSeconds <= v.targetDurationMaxSeconds,
    {
      message: "Minimum duration cannot exceed maximum duration",
      path: ["targetDurationMinSeconds"],
    },
  )
  .superRefine(validateContentFormatDefaults);
export const videoAssociationSchema = z.object({
  videoId: uuid,
  role: videoRoleSchema.default("supporting"),
  source: associationSourceSchema.default("manual"),
  confidence,
  note: shortText,
});
export const channelAssociationSchema = z.object({
  channelId: uuid,
  role: channelRoleSchema.default("occasional"),
  source: associationSourceSchema.default("manual"),
  confidence,
  note: shortText,
});
export const evidenceSchema = z
  .object({
    videoId: uuid.nullable().optional(),
    channelId: uuid.nullable().optional(),
    evidenceType: evidenceTypeSchema,
    statement: z.string().trim().min(1).max(5000),
    source: evidenceSourceSchema.default("manual"),
    confidence,
    provenance: provenanceSchema,
  })
  .superRefine((v, ctx) => {
    if (!v.videoId && !v.channelId && !v.provenance?.discoveryRunId)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provenance"],
        message: "Evidence needs a linked object or Discovery provenance",
      });
  });
export const bulkVideoAssociationSchema = z
  .object({
    videoIds: z.array(uuid).min(1).max(250),
    role: videoRoleSchema.default("supporting"),
    source: z.literal("discovery"),
    discoveryRunId: uuid,
    clusterId: uuid.optional(),
  })
  .strict();

export class ContentFormatConflictError extends Error {}
export class ContentFormatNotFoundError extends ContentFormatConflictError {}
export function notFound(value: unknown): never {
  throw new ContentFormatNotFoundError(
    typeof value === "string" ? value : "Not found",
  );
}
function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "content-format"
  );
}
async function slugFor(name: string) {
  const base = slugify(name);
  for (let n = 1; n < 1000; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const found = await db
      .select({ id: contentFormats.id })
      .from(contentFormats)
      .where(eq(contentFormats.slug, slug))
      .limit(1);
    if (!found.length) return slug;
  }
  throw new ContentFormatConflictError("Could not allocate a unique slug");
}
async function requireFormat(id: string, writable = false) {
  const [format] = await db
    .select()
    .from(contentFormats)
    .where(eq(contentFormats.id, uuid.parse(id)))
    .limit(1);
  if (!format) notFound("Content format not found");
  if (writable && format.status === "archived")
    throw new ContentFormatConflictError(
      "Archived content formats cannot receive new associations or evidence",
    );
  return format;
}
async function requireVideo(id: string) {
  const [row] = await db
    .select({ id: youtubeVideos.id })
    .from(youtubeVideos)
    .where(eq(youtubeVideos.id, id))
    .limit(1);
  if (!row) notFound("Video not found");
}
async function requireChannel(id: string) {
  const [row] = await db
    .select({ id: youtubeChannels.id })
    .from(youtubeChannels)
    .where(eq(youtubeChannels.id, id))
    .limit(1);
  if (!row) notFound("Channel not found");
}
async function requireDiscoveryRun(id: string) {
  const [row] = await db
    .select({ id: discoveryRuns.id })
    .from(discoveryRuns)
    .where(eq(discoveryRuns.id, id))
    .limit(1);
  if (!row) notFound("Discovery run not found");
}

export async function createContentFormat(input: unknown) {
  const values = createContentFormatSchema.parse(input);
  const slug = await slugFor(values.name);
  const [row] = await db
    .insert(contentFormats)
    .values({ ...values, status: "draft", slug })
    .returning();
  return row;
}
export async function updateContentFormat(id: string, input: unknown) {
  await requireFormat(id, true);
  const values = updateContentFormatSchema.parse(input);
  const [row] = await db
    .update(contentFormats)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(contentFormats.id, id))
    .returning();
  return row;
}
export async function archiveContentFormat(id: string) {
  const format = await requireFormat(id);
  if (format.status !== "active")
    throw new ContentFormatConflictError(
      "Only active content formats can be archived",
    );
  const [row] = await db
    .update(contentFormats)
    .set({ status: "archived", updatedAt: new Date().toISOString() })
    .where(eq(contentFormats.id, id))
    .returning();
  return row;
}
export async function restoreContentFormat(id: string) {
  const format = await requireFormat(id);
  if (format.status !== "archived")
    throw new ContentFormatConflictError(
      "Only archived content formats can be restored",
    );
  const [row] = await db
    .update(contentFormats)
    .set({ status: "draft", updatedAt: new Date().toISOString() })
    .where(eq(contentFormats.id, id))
    .returning();
  return row;
}
export async function activateContentFormat(id: string) {
  return db.transaction(async (tx) => {
    const [format] = await tx
      .select()
      .from(contentFormats)
      .where(eq(contentFormats.id, uuid.parse(id)))
      .limit(1);
    if (!format) notFound("Content format not found");
    if (format.status !== "draft")
      throw new ContentFormatConflictError(
        "Only draft content formats can be activated",
      );
    const [row] = await tx
      .select({ videoCount: count(contentFormatVideos.videoId) })
      .from(contentFormatVideos)
      .where(eq(contentFormatVideos.contentFormatId, id));
    if (Number(row.videoCount) < 1)
      throw new ContentFormatConflictError(
        "Add at least one video before activating this format",
      );
    const [updated] = await tx
      .update(contentFormats)
      .set({ status: "active", updatedAt: new Date().toISOString() })
      .where(and(eq(contentFormats.id, id), eq(contentFormats.status, "draft")))
      .returning();
    if (!updated)
      throw new ContentFormatConflictError(
        "Content format status changed before activation",
      );
    return updated;
  });
}
export async function listContentFormats(
  input: { status?: string; search?: string; limit?: string } = {},
) {
  const limit = Math.min(Math.max(Number(input.limit ?? 50) || 50, 1), 100);
  const status = input.status
    ? formatStatusSchema.parse(input.status)
    : undefined;
  const search = input.search?.trim().toLowerCase();
  const rows = await db
    .select({
      format: contentFormats,
      videoCount: count(contentFormatVideos.videoId),
      channelCount: count(contentFormatChannels.channelId),
      evidenceCount: sql<number>`(select count(*) from content_format_evidence e where e.content_format_id = ${contentFormats.id})`,
    })
    .from(contentFormats)
    .leftJoin(
      contentFormatVideos,
      eq(contentFormatVideos.contentFormatId, contentFormats.id),
    )
    .leftJoin(
      contentFormatChannels,
      eq(contentFormatChannels.contentFormatId, contentFormats.id),
    )
    .where(status ? eq(contentFormats.status, status) : undefined)
    .groupBy(contentFormats.id)
    .orderBy(desc(contentFormats.updatedAt))
    .limit(search ? 100 : limit);
  return search
    ? rows
        .filter((r) => r.format.name.toLowerCase().includes(search))
        .slice(0, limit)
    : rows;
}

export async function attachVideoToContentFormat(id: string, input: unknown) {
  const values = videoAssociationSchema.parse(input);
  await requireFormat(id, true);
  await requireVideo(values.videoId);
  await db
    .insert(contentFormatVideos)
    .values({
      contentFormatId: id,
      ...values,
      confidence: values.confidence == null ? null : String(values.confidence),
    })
    .onConflictDoNothing();
  return getVideoAssociation(id, values.videoId);
}
async function getVideoAssociation(id: string, videoId: string) {
  const [row] = await db
    .select()
    .from(contentFormatVideos)
    .where(
      and(
        eq(contentFormatVideos.contentFormatId, id),
        eq(contentFormatVideos.videoId, videoId),
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function updateVideoAssociation(
  id: string,
  videoId: string,
  input: unknown,
) {
  await requireFormat(id, true);
  const values = videoAssociationSchema
    .omit({ videoId: true })
    .partial()
    .parse(input);
  const [row] = await db
    .update(contentFormatVideos)
    .set({
      ...values,
      confidence:
        values.confidence == null ? undefined : String(values.confidence),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(contentFormatVideos.contentFormatId, id),
        eq(contentFormatVideos.videoId, uuid.parse(videoId)),
      ),
    )
    .returning();
  if (!row) notFound("Video association not found");
  return row;
}
export async function detachVideoFromContentFormat(
  id: string,
  videoId: string,
) {
  await requireFormat(id, true);
  const [row] = await db
    .delete(contentFormatVideos)
    .where(
      and(
        eq(contentFormatVideos.contentFormatId, id),
        eq(contentFormatVideos.videoId, uuid.parse(videoId)),
      ),
    )
    .returning();
  if (!row) notFound("Video association not found");
}
export async function bulkAttachVideosToContentFormat(
  id: string,
  input: unknown,
) {
  const values = bulkVideoAssociationSchema.parse(input);
  const videoIds = [...new Set(values.videoIds)];
  return db.transaction(async (tx) => {
    const [format] = await tx
      .select()
      .from(contentFormats)
      .where(eq(contentFormats.id, uuid.parse(id)))
      .limit(1);
    if (!format) notFound("Content format not found");
    if (format.status === "archived")
      throw new ContentFormatConflictError(
        "Archived content formats cannot receive new associations or evidence",
      );
    const [run] = await tx
      .select({ id: discoveryRuns.id })
      .from(discoveryRuns)
      .where(eq(discoveryRuns.id, values.discoveryRunId))
      .limit(1);
    if (!run) notFound("Discovery run not found");
    const existing = await tx
      .select({ id: youtubeVideos.id })
      .from(youtubeVideos)
      .where(inArray(youtubeVideos.id, videoIds));
    const existingIds = new Set(existing.map(({ id }) => id));
    const unknown = videoIds.filter((videoId) => !existingIds.has(videoId));
    if (unknown.length) notFound("Video not found");
    const members = await tx
      .selectDistinct({ videoId: videoDiscoveries.videoId })
      .from(videoDiscoveries)
      .where(
        and(
          eq(videoDiscoveries.runId, values.discoveryRunId),
          inArray(videoDiscoveries.videoId, videoIds),
        ),
      );
    const memberIds = new Set(members.map(({ videoId }) => videoId));
    const nonMembers = videoIds.filter((videoId) => !memberIds.has(videoId));
    if (nonMembers.length)
      throw new ContentFormatConflictError(
        "Discovery video is not part of the supplied run",
      );
    await tx
      .insert(contentFormatVideos)
      .values(
        videoIds.map((videoId) => ({
          contentFormatId: id,
          videoId,
          role: values.role,
          source: values.source,
          note: null,
        })),
      )
      .onConflictDoNothing();
    return { attachedVideoIds: videoIds };
  });
}

export async function attachChannelToContentFormat(id: string, input: unknown) {
  const values = channelAssociationSchema.parse(input);
  await requireFormat(id, true);
  await requireChannel(values.channelId);
  await db
    .insert(contentFormatChannels)
    .values({
      contentFormatId: id,
      ...values,
      confidence: values.confidence == null ? null : String(values.confidence),
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(contentFormatChannels)
    .where(
      and(
        eq(contentFormatChannels.contentFormatId, id),
        eq(contentFormatChannels.channelId, values.channelId),
      ),
    )
    .limit(1);
  return row;
}
export async function updateChannelAssociation(
  id: string,
  channelId: string,
  input: unknown,
) {
  await requireFormat(id, true);
  const values = channelAssociationSchema
    .omit({ channelId: true })
    .partial()
    .parse(input);
  const [row] = await db
    .update(contentFormatChannels)
    .set({
      ...values,
      confidence:
        values.confidence == null ? undefined : String(values.confidence),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(contentFormatChannels.contentFormatId, id),
        eq(contentFormatChannels.channelId, uuid.parse(channelId)),
      ),
    )
    .returning();
  if (!row) notFound("Channel association not found");
  return row;
}
export async function detachChannelFromContentFormat(
  id: string,
  channelId: string,
) {
  await requireFormat(id, true);
  const [row] = await db
    .delete(contentFormatChannels)
    .where(
      and(
        eq(contentFormatChannels.contentFormatId, id),
        eq(contentFormatChannels.channelId, uuid.parse(channelId)),
      ),
    )
    .returning();
  if (!row) notFound("Channel association not found");
}

export async function createContentFormatEvidence(id: string, input: unknown) {
  const values = evidenceSchema.parse(input);
  await requireFormat(id, true);
  if (values.videoId) await requireVideo(values.videoId);
  if (values.channelId) await requireChannel(values.channelId);
  if (values.provenance?.discoveryRunId)
    await requireDiscoveryRun(values.provenance.discoveryRunId);
  const [row] = await db
    .insert(contentFormatEvidence)
    .values({
      contentFormatId: id,
      ...values,
      confidence: values.confidence == null ? null : String(values.confidence),
    })
    .returning();
  return row;
}
export async function updateContentFormatEvidence(
  id: string,
  evidenceId: string,
  input: unknown,
) {
  await requireFormat(id, true);
  const values = z
    .object({
      videoId: uuid.nullable().optional(),
      channelId: uuid.nullable().optional(),
      evidenceType: evidenceTypeSchema.optional(),
      statement: z.string().trim().min(1).max(5000).optional(),
      source: evidenceSourceSchema.optional(),
      confidence,
      provenance: provenanceSchema,
    })
    .refine((v) => Object.keys(v).length > 0, "At least one field is required")
    .parse(input);
  const [row] = await db
    .update(contentFormatEvidence)
    .set({
      ...values,
      confidence:
        values.confidence == null ? undefined : String(values.confidence),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(contentFormatEvidence.contentFormatId, id),
        eq(contentFormatEvidence.id, uuid.parse(evidenceId)),
      ),
    )
    .returning();
  if (!row) notFound("Evidence not found");
  return row;
}
export async function deleteContentFormatEvidence(
  id: string,
  evidenceId: string,
) {
  await requireFormat(id, true);
  const [row] = await db
    .delete(contentFormatEvidence)
    .where(
      and(
        eq(contentFormatEvidence.contentFormatId, id),
        eq(contentFormatEvidence.id, uuid.parse(evidenceId)),
      ),
    )
    .returning();
  if (!row) notFound("Evidence not found");
}

export async function getContentFormatDetail(
  id: string,
  input: { limit?: string } = {},
) {
  const format = await requireFormat(id);
  const limit = Math.min(Math.max(Number(input.limit ?? 50) || 50, 1), 100);
  const [videos, channels, evidence, counts] = await Promise.all([
    db
      .select({ association: contentFormatVideos, video: youtubeVideos })
      .from(contentFormatVideos)
      .innerJoin(
        youtubeVideos,
        eq(youtubeVideos.id, contentFormatVideos.videoId),
      )
      .where(eq(contentFormatVideos.contentFormatId, id))
      .orderBy(asc(contentFormatVideos.createdAt))
      .limit(limit),
    db
      .select({
        association: contentFormatChannels,
        channel: youtubeChannels,
        associatedVideoCount: sql<number>`(select count(*) from content_format_videos fv join youtube_videos v on v.id=fv.video_id where fv.content_format_id=${id} and v.channel_id=${youtubeChannels.id})`,
      })
      .from(contentFormatChannels)
      .innerJoin(
        youtubeChannels,
        eq(youtubeChannels.id, contentFormatChannels.channelId),
      )
      .where(eq(contentFormatChannels.contentFormatId, id))
      .orderBy(asc(contentFormatChannels.createdAt))
      .limit(limit),
    db
      .select({
        evidence: contentFormatEvidence,
        video: youtubeVideos,
        channel: youtubeChannels,
      })
      .from(contentFormatEvidence)
      .leftJoin(
        youtubeVideos,
        eq(youtubeVideos.id, contentFormatEvidence.videoId),
      )
      .leftJoin(
        youtubeChannels,
        eq(youtubeChannels.id, contentFormatEvidence.channelId),
      )
      .where(eq(contentFormatEvidence.contentFormatId, id))
      .orderBy(desc(contentFormatEvidence.createdAt))
      .limit(limit),
    db
      .select({
        videoCount: count(contentFormatVideos.videoId),
        exemplarVideoCount: sql<number>`count(*) filter (where ${contentFormatVideos.role} = 'exemplar')`,
        channelCount: sql<number>`(select count(*) from content_format_channels c where c.content_format_id=${id})`,
        evidenceCount: sql<number>`(select count(*) from content_format_evidence e where e.content_format_id=${id})`,
      })
      .from(contentFormatVideos)
      .where(eq(contentFormatVideos.contentFormatId, id)),
  ]);
  const rawCounts = counts[0];
  return {
    format,
    videos,
    channels,
    evidence,
    counts: {
      videoCount: Number(rawCounts.videoCount),
      exemplarVideoCount: Number(rawCounts.exemplarVideoCount),
      channelCount: Number(rawCounts.channelCount),
      evidenceCount: Number(rawCounts.evidenceCount),
    },
  };
}
