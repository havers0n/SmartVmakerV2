import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ScenarioGenerationError } from '@/shared/scenarios';

vi.mock('@/shared/lib/db', () => ({ db: {} }));

vi.mock('@/shared/lib/auth', () => ({
  getTrustedUserId: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
  unauthorizedResponse: vi.fn(),
}));

vi.mock('./handlers/generation', () => ({
  startProject: vi.fn(async () => {
    throw new ScenarioGenerationError('SCENARIO_GENERATION_TRUNCATED');
  }),
  generateKeyframes: vi.fn(),
  startAnimation: vi.fn(),
}));

import { POST } from './route';

describe('actions API scenario generation errors', () => {
  it('returns typed non-2xx without a success result', async () => {
    const request = new NextRequest('http://localhost/api/actions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'generation.startProject', payload: {} }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      success: false,
      code: 'SCENARIO_GENERATION_TRUNCATED',
    });
    expect(body.result).toBeUndefined();
    expect(body.message).toBeUndefined();
  });
});
