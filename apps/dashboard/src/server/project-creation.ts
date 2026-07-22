import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { beats, contentFormats, generationProjects, storyTemplates } from '@/shared/lib/schema';

const uuid = z.string().uuid();
const common = {
  title: z.string().trim().min(1).max(200).optional(),
  ratio: z.enum(['16:9', '9:16', '4:3', '3:4']).default('16:9'),
  lang: z.string().trim().min(1).max(32).default('none'),
  ownerId: uuid.optional(),
  textModelId: z.string().trim().min(1).max(200).optional(),
  imageModelId: z.string().trim().min(1).max(200).optional(),
  prompt: z.string().trim().min(1, 'A project idea is required').max(10_000),
};

export const canonicalStartProjectSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('prompt'), contentFormatId: z.null().optional(), templateId: z.null().optional(), ...common }).strict(),
  z.object({ source: z.literal('story_template'), templateId: uuid, contentFormatId: z.null().optional(), ...common }).strict(),
  z.object({ source: z.literal('content_format'), contentFormatId: uuid, templateId: uuid.optional(), ...common }).strict(),
]);
const legacyCommon = {
  title: z.string().trim().min(1).max(200).optional(), ratio: z.enum(['16:9', '9:16', '4:3', '3:4']).default('16:9'),
  lang: z.string().trim().min(1).max(32).default('none'), ownerId: uuid.optional(), textModelId: z.string().trim().min(1).max(200).optional(),
  imageModelId: z.string().trim().min(1).max(200).optional(), prompt: z.string().trim().min(1).max(10_000).optional(),
};
/** Temporary compatibility contract for the production wizard; remove after its UI migration. */
export const legacyStartProjectSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('preset'), presetId: uuid, trendId: z.undefined().optional(), ...legacyCommon }).strict(),
  z.object({ source: z.literal('trends'), trendId: z.string().trim().min(1).max(200), presetId: z.undefined().optional(), ...legacyCommon }).strict(),
]);
export const startProjectSchema = z.union([canonicalStartProjectSchema, legacyStartProjectSchema]);
export type StartProjectPayload = z.infer<typeof startProjectSchema>;

export class ProjectCreationError extends Error {
  constructor(public readonly status: 404 | 409, message: string) { super(message); this.name = 'ProjectCreationError'; }
}

type FormatSnapshot = {
  contentFormatId: string; contentFormatName: string; contentFormatSlug: string; contentFormatType: string;
  description: string | null; hookPattern: string | null; structurePattern: string | null;
  visualPattern: string | null; pacingPattern: string | null; durationMinSeconds: number | null;
  durationMaxSeconds: number | null; snapshotCreatedAt: string;
};

async function loadContext(executor: typeof db, input: StartProjectPayload) {
  let contentFormat: FormatSnapshot | null = null;
  let storyTemplate: Record<string, unknown> | null = null;
  if (input.source === 'content_format') {
    const [format] = await executor.select().from(contentFormats).where(eq(contentFormats.id, input.contentFormatId)).limit(1);
    if (!format) throw new ProjectCreationError(404, 'Content format not found');
    if (format.status !== 'active') throw new ProjectCreationError(409, `Content format is ${format.status}`);
    contentFormat = {
      contentFormatId: format.id, contentFormatName: format.name, contentFormatSlug: format.slug,
      contentFormatType: format.formatType, description: format.description, hookPattern: format.hookPattern,
      structurePattern: format.structurePattern, visualPattern: format.visualPattern, pacingPattern: format.pacingPattern,
      durationMinSeconds: format.targetDurationMinSeconds, durationMaxSeconds: format.targetDurationMaxSeconds,
      snapshotCreatedAt: new Date().toISOString(),
    };
  }
  const templateId = input.source === 'story_template' ? input.templateId : input.source === 'content_format' ? input.templateId : input.source === 'preset' ? input.presetId : undefined;
  if (templateId) {
    const [template] = await executor.select().from(storyTemplates).where(eq(storyTemplates.id, templateId)).limit(1);
    if (!template) throw new ProjectCreationError(404, 'Story template not found');
    const templateBeats = await executor.select().from(beats).where(eq(beats.templateId, templateId)).orderBy(beats.order);
    storyTemplate = { templateId: template.id, templateName: template.name, targetDurationSeconds: template.targetDurationSeconds, beats: templateBeats };
  }
  return { prompt: input.prompt ?? '', contentFormat, storyTemplate };
}

/** Resolves immutable inputs for scenario generation without exposing live format IDs to the generator. */
export async function prepareProjectContext(input: StartProjectPayload) {
  return loadContext(db, input);
}

export async function createProjectWithSnapshot(params: {
  input: StartProjectPayload; userId: string; generateScenarios: (context: Awaited<ReturnType<typeof loadContext>>) => Promise<unknown[]>; textModelId?: string; imageModelId?: string;
}) {
  return db.transaction(async (tx) => {
    const context = await loadContext(tx as typeof db, params.input);
    const scenarios = await params.generateScenarios(context);
    const templateId = params.input.source === 'story_template' ? params.input.templateId : params.input.source === 'content_format' ? params.input.templateId : params.input.source === 'preset' ? params.input.presetId : null;
    const [project] = await tx.insert(generationProjects).values({
      ownerId: params.userId, templateId, contentFormatId: context.contentFormat?.contentFormatId ?? null, status: 'pending',
      meta: {
        title: params.input.title || 'Untitled Project', ratio: params.input.ratio, lang: params.input.lang,
        source: params.input.source, prompt: params.input.prompt, trendId: params.input.source === 'trends' ? params.input.trendId : undefined, generationContext: context,
        scenarios, generatedAt: new Date().toISOString(), textModelId: params.textModelId, imageModelId: params.imageModelId,
      },
    }).returning();
    return { project, scenarios };
  });
}
