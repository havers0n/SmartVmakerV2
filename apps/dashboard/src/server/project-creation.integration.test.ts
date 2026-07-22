import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { eq, inArray, sql } from 'drizzle-orm';
import { getPgClient } from '@scrimspec/db';
import { db } from '@/shared/lib/db';
import { beats, contentFormats, generationProjects, storyTemplates } from '@/shared/lib/schema';
import { ProjectCreationError, createProjectWithSnapshot, startProjectSchema } from './project-creation';

// These tests deliberately use the production snapshot service and a real database.
// Every fixture is unique and is removed individually; the shared database is never reset.
const made = { projects: [] as string[], formats: [] as string[], templates: [] as string[] };
const userId = () => randomUUID();
const idea = 'A telescope discovers a city hidden in a black hole.';

async function format(status: 'draft' | 'active' | 'archived' = 'active') {
  const id = randomUUID();
  const [row] = await db.insert(contentFormats).values({
    name: `Project format ${id}`, slug: `project-format-${id}`, status, formatType: 'short_form',
    description: 'Evidence-led cosmic story', hookPattern: 'Start with the impossible',
    structurePattern: 'Question, proof, reveal', visualPattern: 'High contrast nebulae', pacingPattern: 'Fast then pause',
    targetDurationMinSeconds: 22, targetDurationMaxSeconds: 41,
  }).returning();
  made.formats.push(row.id); return row;
}
async function template() {
  const id = randomUUID();
  const [row] = await db.insert(storyTemplates).values({ name: `Project template ${id}`, targetDurationSeconds: 75 }).returning();
  made.templates.push(row.id);
  await db.insert(beats).values({ templateId: row.id, order: 1, phase: 'HOOK', durationSeconds: '4', description: 'Original beat', emotion: 'surprise' });
  return row;
}
async function create(input: unknown, capture?: (context: any) => void) {
  const parsed = startProjectSchema.parse(input);
  const result = await createProjectWithSnapshot({ input: parsed, userId: userId(), generateScenarios: async (context) => { capture?.(context); return [{ title: 'scenario' }]; } });
  made.projects.push(result.project.id); return result.project;
}
async function countProjects() {
  if (!made.projects.length) return 0;
  return (await db.select({ id: generationProjects.id }).from(generationProjects).where(inArray(generationProjects.id, made.projects))).length;
}

afterEach(async () => {
  for (const id of made.projects.splice(0)) await db.delete(generationProjects).where(eq(generationProjects.id, id));
  for (const id of made.templates.splice(0)) await db.delete(storyTemplates).where(eq(storyTemplates.id, id));
  for (const id of made.formats.splice(0)) await db.delete(contentFormats).where(eq(contentFormats.id, id));
});
afterAll(async () => { await getPgClient().end(); });

describe.sequential('project creation DB integration', () => {
  it('persists the canonical prompt project with no relations', async () => {
    const project = await create({ source: 'prompt', prompt: idea });
    expect(project.contentFormatId).toBeNull(); expect(project.templateId).toBeNull();
    expect(project.meta).toMatchObject({ source: 'prompt', generationContext: { prompt: idea, contentFormat: null, storyTemplate: null } });
    expect(await countProjects()).toBe(1);
  });

  it('snapshots a standalone story template and its beats immutably', async () => {
    const t = await template(); const project = await create({ source: 'story_template', templateId: t.id, prompt: idea });
    const snapshot: any = (project.meta as any).generationContext.storyTemplate;
    expect(project.contentFormatId).toBeNull(); expect(project.templateId).toBe(t.id);
    expect(snapshot).toMatchObject({ templateId: t.id, templateName: t.name, targetDurationSeconds: 75 }); expect(snapshot.beats).toHaveLength(1);
    await db.update(storyTemplates).set({ name: 'Changed live template', targetDurationSeconds: 9 }).where(eq(storyTemplates.id, t.id));
    await db.update(beats).set({ description: 'Changed live beat' }).where(eq(beats.templateId, t.id));
    const [stored] = await db.select().from(generationProjects).where(eq(generationProjects.id, project.id));
    expect((stored.meta as any).generationContext.storyTemplate).toEqual(snapshot);
  });

  it('snapshots a format, retains provenance when archived, and keeps idea independent', async () => {
    const f = await format(); const project = await create({ source: 'content_format', contentFormatId: f.id, prompt: idea });
    const snapshot: any = (project.meta as any).generationContext.contentFormat;
    expect(project.contentFormatId).toBe(f.id); expect(project.templateId).toBeNull(); expect((project.meta as any).prompt).toBe(idea);
    expect(snapshot).toMatchObject({ contentFormatId: f.id, contentFormatName: f.name, contentFormatSlug: f.slug, contentFormatType: 'short_form', description: f.description, hookPattern: f.hookPattern, structurePattern: f.structurePattern, visualPattern: f.visualPattern, pacingPattern: f.pacingPattern, durationMinSeconds: 22, durationMaxSeconds: 41 });
    await db.update(contentFormats).set({ name: 'Changed live format', status: 'archived', hookPattern: 'Changed hook' }).where(eq(contentFormats.id, f.id));
    const [stored] = await db.select().from(generationProjects).where(eq(generationProjects.id, project.id));
    expect((stored.meta as any).generationContext.contentFormat).toEqual(snapshot);
    const provenance = await db.select({ status: contentFormats.status }).from(generationProjects).leftJoin(contentFormats, eq(contentFormats.id, generationProjects.contentFormatId)).where(eq(generationProjects.id, project.id));
    expect(provenance[0].status).toBe('archived');
  });

  it('keeps format duration primary when a format and template are combined', async () => {
    const f = await format(); const t = await template(); const project = await create({ source: 'content_format', contentFormatId: f.id, templateId: t.id, prompt: idea });
    const ctx: any = (project.meta as any).generationContext;
    expect(project).toMatchObject({ contentFormatId: f.id, templateId: t.id });
    expect(ctx.contentFormat).toMatchObject({ durationMinSeconds: 22, durationMaxSeconds: 41 });
    expect(ctx.storyTemplate).toMatchObject({ targetDurationSeconds: 75 }); expect(ctx.storyTemplate.beats).toHaveLength(1);
  });

  it('rejects invalid canonical input before a row can be created', async () => {
    const f = await format(); const t = await template();
    const before = (await db.select({ id: generationProjects.id }).from(generationProjects)).length;
    for (const input of [
      { source: 'content_format', prompt: idea }, { source: 'story_template', prompt: idea },
      { source: 'prompt', prompt: idea, contentFormatId: f.id }, { source: 'prompt', prompt: idea, templateId: t.id },
      { source: 'story_template', prompt: idea, templateId: t.id, contentFormatId: f.id }, { source: 'unknown', prompt: idea },
      { source: 'content_format', prompt: idea, contentFormatId: f.id, unknown: true },
    ]) expect(() => startProjectSchema.parse(input)).toThrow();
    expect((await db.select({ id: generationProjects.id }).from(generationProjects)).length).toBe(before);
  });

  it('rejects unknown, draft, and archived relations without partial projects', async () => {
    const draft = await format('draft'); const archived = await format('archived'); const unknown = randomUUID();
    const before = (await db.select({ id: generationProjects.id }).from(generationProjects)).length;
    for (const input of [
      { source: 'content_format', contentFormatId: unknown, prompt: idea }, { source: 'story_template', templateId: unknown, prompt: idea },
      { source: 'content_format', contentFormatId: draft.id, prompt: idea }, { source: 'content_format', contentFormatId: archived.id, prompt: idea },
    ]) await expect(create(input)).rejects.toBeInstanceOf(ProjectCreationError);
    expect((await db.select({ id: generationProjects.id }).from(generationProjects)).length).toBe(before);
  });

  it('preserves legacy preset and trends payloads without fabricating a format relation', async () => {
    const t = await template();
    const preset = await create({ source: 'preset', presetId: t.id, title: 'Preset project' });
    const trend = await create({ source: 'trends', trendId: 'legacy-trend', title: 'Trend project' });
    expect(preset).toMatchObject({ templateId: t.id, contentFormatId: null }); expect((preset.meta as any).source).toBe('preset');
    expect(trend).toMatchObject({ templateId: null, contentFormatId: null }); expect((trend.meta as any)).toMatchObject({ source: 'trends', trendId: 'legacy-trend' });
    const [stored] = await db.select().from(generationProjects).where(eq(generationProjects.id, trend.id)); expect((stored.meta as any).trendId).toBe('legacy-trend');
  });

  it('passes immutable snapshots to the actual generation dependency', async () => {
    const f = await format(); const t = await template(); let captured: any;
    const project = await create({ source: 'content_format', contentFormatId: f.id, templateId: t.id, prompt: idea }, (context) => { captured = context; });
    await db.update(contentFormats).set({ hookPattern: 'Live mutation' }).where(eq(contentFormats.id, f.id)); await db.update(beats).set({ description: 'Live mutation' }).where(eq(beats.templateId, t.id));
    const stored = (await db.select().from(generationProjects).where(eq(generationProjects.id, project.id)))[0];
    expect(captured).toEqual((stored.meta as any).generationContext);
    expect(captured.contentFormat.hookPattern).toBe('Start with the impossible'); expect(captured.storyTemplate.beats[0].description).toBe('Original beat');
  });

  it('has nullable indexed restricted FK migration contract and accepts legacy null rows', async () => {
    const project = await create({ source: 'prompt', prompt: idea });
    const columns: any = await db.execute(sql`select is_nullable from information_schema.columns where table_schema='generation_pipeline' and table_name='generation_projects' and column_name='content_format_id'`);
    const constraints: any = await db.execute(sql`select confdeltype from pg_constraint where conname='generation_projects_content_format_id_content_formats_id_fk'`);
    const indexes: any = await db.execute(sql`select indexname from pg_indexes where schemaname='generation_pipeline' and tablename='generation_projects' and indexname='generation_projects_content_format_id_idx'`);
    expect(columns.rows[0].is_nullable).toBe('YES'); expect(constraints.rows[0].confdeltype).toBe('r'); expect(indexes.rows).toHaveLength(1); expect(project.contentFormatId).toBeNull();
    await expect(db.execute(sql`insert into generation_pipeline.generation_projects (owner_id, content_format_id) values (${randomUUID()}::uuid, ${randomUUID()}::uuid)`)).rejects.toThrow();
  });
});
