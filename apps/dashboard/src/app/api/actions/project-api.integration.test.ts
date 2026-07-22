import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { getPgClient } from '@scrimspec/db';
import { db } from '@/shared/lib/db';
import { beats, contentFormats, generationProjects, storyTemplates } from '@/shared/lib/schema';
import { POST as actions } from './route';
import { GET as detail } from '@/app/api/generation/projects/[project_id]/route';

vi.mock('@scrimspec/halu-client', () => ({ createTextClient: vi.fn(), generateScenariosWithTools: vi.fn(async () => ({ toolCalls: [{ function: { name: 'generate_video_scenarios', argumentsParsed: { scenarios: [{ title: 'mock' }] } } }] })) }));
process.env.MINIMAX_API_KEY = 'test';

const made = { p: [] as string[], f: [] as string[], t: [] as string[] }; const owner = randomUUID(); const idea = 'API project idea';
const req = (payload: unknown) => new NextRequest('http://test/api/actions', { method: 'POST', headers: { 'content-type': 'application/json', 'x-scrimspec-user-id': owner }, body: JSON.stringify({ action: 'generation.startProject', payload }) });
async function fixtures() {
  const key = randomUUID(); const [f] = await db.insert(contentFormats).values({ name: `API ${key}`, slug: `api-${key}`, status: 'active', description: 'desc', hookPattern: 'hook', structurePattern: 'structure', visualPattern: 'visual', pacingPattern: 'pace', targetDurationMinSeconds: 10, targetDurationMaxSeconds: 20 }).returning(); made.f.push(f.id);
  const [t] = await db.insert(storyTemplates).values({ name: `API template ${key}`, targetDurationSeconds: 50 }).returning(); made.t.push(t.id); await db.insert(beats).values({ templateId: t.id, order: 1, phase: 'HOOK', durationSeconds: '2', description: 'beat', emotion: 'surprise' }); return { f, t };
}
afterEach(async () => { for (const id of made.p.splice(0)) await db.delete(generationProjects).where(eq(generationProjects.id, id)); for (const id of made.t.splice(0)) await db.delete(storyTemplates).where(eq(storyTemplates.id, id)); for (const id of made.f.splice(0)) await db.delete(contentFormats).where(eq(contentFormats.id, id)); }); afterAll(async () => { await getPgClient().end(); });

describe.sequential('project API integration', () => {
  it('creates all production and legacy request shapes through POST /api/actions', async () => {
    const { f, t } = await fixtures(); const payloads = [
      { source: 'prompt', prompt: idea, title: 'Prompt title' }, { source: 'story_template', templateId: t.id, prompt: idea, title: 'Template title' },
      { source: 'content_format', contentFormatId: f.id, prompt: idea, title: 'Format title' }, { source: 'content_format', contentFormatId: f.id, templateId: t.id, prompt: idea, title: 'Combined title' },
      { source: 'preset', presetId: t.id, title: 'Preset title' }, { source: 'trends', trendId: 'trend-1', title: 'Trend title' },
    ];
    for (const payload of payloads) { const response = await actions(req(payload)); expect(response.status).toBe(200); made.p.push((await response.json()).result.project.id); }
    const rows = await db.select().from(generationProjects).where(eq(generationProjects.ownerId, owner)); expect(rows).toHaveLength(6);
    const byId = new Map(rows.map((row: any) => [row.id, row])); const created = made.p.map((id) => byId.get(id)!);
    expect(created.map((x: any) => x.contentFormatId)).toEqual([null, null, f.id, f.id, null, null]); expect(created.map((x: any) => x.templateId)).toEqual([null, t.id, null, t.id, t.id, null]);
    const list = await actions(new NextRequest('http://test/api/actions', { method: 'POST', headers: { 'content-type': 'application/json', 'x-scrimspec-user-id': owner }, body: JSON.stringify({ action: 'projects.list', payload: {} }) })); const listed = (await list.json()).result;
    expect(listed).toHaveLength(6); expect(listed.find((x: any) => x.title === 'Combined title')).toMatchObject({ contentFormat: { id: f.id }, storyTemplate: { id: t.id } });
    const archivedProject = created[2]; await db.update(contentFormats).set({ status: 'archived' }).where(eq(contentFormats.id, f.id)); const response = await detail(new NextRequest(`http://test/api/generation/projects/${archivedProject.id}`, { headers: { 'x-scrimspec-user-id': owner } }), { params: { project_id: archivedProject.id } }); const body = await response.json();
    expect(response.status).toBe(200); expect(body).toMatchObject({ contentFormat: { id: f.id, status: 'archived' }, storyTemplate: null }); expect(body.meta).toMatchObject({ prompt: idea, generationContext: { contentFormat: { hookPattern: 'hook' } } }); expect(body.meta.title).toBe('Format title');
  });
  it('maps strict validation, relation errors, and rollback through the route', async () => {
    const { f, t } = await fixtures(); const before = (await db.select().from(generationProjects).where(eq(generationProjects.ownerId, owner))).length;
    for (const [payload, status] of [[{ source: 'prompt', prompt: idea, bad: true }, 400], [{ source: 'prompt', prompt: idea, contentFormatId: f.id }, 400], [{ source: 'content_format', contentFormatId: randomUUID(), prompt: idea }, 404], [{ source: 'story_template', templateId: randomUUID(), prompt: idea }, 404]] as const) expect((await actions(req(payload))).status).toBe(status);
    await db.update(contentFormats).set({ status: 'draft' }).where(eq(contentFormats.id, f.id)); expect((await actions(req({ source: 'content_format', contentFormatId: f.id, prompt: idea }))).status).toBe(409); await db.update(contentFormats).set({ status: 'archived' }).where(eq(contentFormats.id, f.id)); expect((await actions(req({ source: 'content_format', contentFormatId: f.id, prompt: idea }))).status).toBe(409);
    expect((await db.select().from(generationProjects).where(eq(generationProjects.ownerId, owner))).length).toBe(before); expect(t.id).toBeTruthy();
  });
});
