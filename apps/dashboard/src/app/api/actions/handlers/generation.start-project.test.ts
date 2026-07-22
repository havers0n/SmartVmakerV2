import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectResult: [] as unknown[],
  insertedValues: undefined as unknown,
  generateResponse: undefined as unknown,
  insert: vi.fn(),
}));

vi.mock('@/shared/lib/db', () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => mocks.selectResult),
    })),
    insert: mocks.insert.mockImplementation(() => ({
      values: vi.fn((values: unknown) => {
        mocks.insertedValues = values;
        return {
          returning: vi.fn(async () => [{
            id: '1f08fe25-cb9b-4fc6-baa8-d8af2573c32e',
            status: 'pending',
            createdAt: '2026-07-22T00:00:00.000Z',
          }]),
        };
      }),
    })),
    transaction: vi.fn(),
  };
  db.transaction.mockImplementation(async (callback: (executor: typeof db) => unknown) => callback(db));
  return { db };
});

vi.mock('@scrimspec/halu-client', () => ({
  createTextClient: vi.fn(() => ({})),
  generateScenariosWithTools: vi.fn(async () => mocks.generateResponse),
}));

vi.mock('@aec/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { startProject } from './generation';

const validScenario = {
  title: 'Valid concept',
  description: 'A complete concept.',
  aesScore: 91,
  hookStrength: 93,
  emotionalCurve: ['curiosity'],
  scenes: [{ phase: 'HOOK', duration: 2, description: 'Opening frame.' }],
};

function providerResponse(scenarios: unknown, finishReason = 'stop') {
  const args = { scenarios };
  return {
    content: null,
    finishReason,
    message: { role: 'assistant', content: null },
    toolCalls: [{
      id: 'tool-call-1',
      type: 'function',
      function: {
        name: 'generate_video_scenarios',
        arguments: JSON.stringify(args),
        argumentsParsed: args,
      },
    }],
  };
}

const payload = {
  source: 'prompt' as const,
  prompt: 'Create a crash-test video.',
  title: 'Test project',
  ratio: '16:9' as const,
  lang: 'none',
  textModelId: 'minimax-model-row',
  imageModelId: 'image-model-row',
};

describe('startProject scenario persistence boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MINIMAX_API_KEY = 'test-key';
    delete process.env.HWAR_ENABLE_MOCK_GENERATION;
    mocks.selectResult = [];
    mocks.insertedValues = undefined;
  });

  it('rejects an invalid provider result before insert', async () => {
    const fixture = readFileSync(
      new URL('../../../../shared/__fixtures__/beamngtest1-truncated-scenarios.txt', import.meta.url),
      'utf8',
    ).replace(/\r?\n$/, '');
    mocks.generateResponse = providerResponse(fixture);

    await expect(startProject(payload, { userId: '550e8400-e29b-41d4-a716-446655440000' }))
      .rejects.toMatchObject({
        code: 'SCENARIO_GENERATION_TRUNCATED',
      });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('inserts only validated arrays and reports object count', async () => {
    mocks.generateResponse = providerResponse([validScenario, { ...validScenario, title: 'Second' }]);

    const result = await startProject(payload, { userId: '550e8400-e29b-41d4-a716-446655440000' });
    const values = mocks.insertedValues as { meta: { scenarios: unknown } };

    expect(Array.isArray(values.meta.scenarios)).toBe(true);
    expect(values.meta.scenarios).toHaveLength(2);
    expect(result.message).toBe('Generated 2 scenario concepts');
    expect(mocks.insert).toHaveBeenCalledOnce();
  });
});
