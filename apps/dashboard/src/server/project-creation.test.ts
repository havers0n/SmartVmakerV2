import { describe, expect, it } from 'vitest';
import 'dotenv/config';
import { canonicalStartProjectSchema, legacyStartProjectSchema, startProjectSchema } from './project-creation';

const id = '550e8400-e29b-41d4-a716-446655440000';
const base = { prompt: 'What happens if Earth loses oxygen for five seconds?' };

describe('project creation source contract', () => {
  it('accepts every supported creation scenario', () => {
    expect(canonicalStartProjectSchema.safeParse({ source: 'prompt', ...base }).success).toBe(true);
    expect(canonicalStartProjectSchema.safeParse({ source: 'story_template', templateId: id, ...base }).success).toBe(true);
    expect(canonicalStartProjectSchema.safeParse({ source: 'content_format', contentFormatId: id, ...base }).success).toBe(true);
    expect(canonicalStartProjectSchema.safeParse({ source: 'content_format', contentFormatId: id, templateId: id, ...base }).success).toBe(true);
  });

  it('rejects invalid source combinations and legacy trend creation', () => {
    for (const payload of [
      { source: 'prompt', contentFormatId: id, ...base },
      { source: 'prompt', templateId: id, ...base },
      { source: 'story_template', ...base },
      { source: 'story_template', contentFormatId: id, templateId: id, ...base },
      { source: 'content_format', ...base },
      { source: 'trends', trendId: 'old', ...base },
      { source: 'content_format', contentFormatId: id, ...base, unexpected: true },
    ]) expect(canonicalStartProjectSchema.safeParse(payload).success).toBe(false);
  });

  it('requires a bounded, non-empty project idea in every scenario', () => {
    expect(canonicalStartProjectSchema.safeParse({ source: 'prompt', prompt: '   ' }).success).toBe(false);
    expect(canonicalStartProjectSchema.safeParse({ source: 'content_format', contentFormatId: id, prompt: 'x'.repeat(10_001) }).success).toBe(false);
  });

  it('accepts the exact legacy wizard payloads without weakening canonical validation', () => {
    expect(legacyStartProjectSchema.safeParse({ source: 'preset', presetId: id, title: 'Preset', ratio: '16:9', lang: 'none' }).success).toBe(true);
    expect(legacyStartProjectSchema.safeParse({ source: 'trends', trendId: 'trend-1', title: 'Trend', ratio: '16:9', lang: 'none' }).success).toBe(true);
    expect(startProjectSchema.safeParse({ source: 'unknown', ...base }).success).toBe(false);
  });
});
