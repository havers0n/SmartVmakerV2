// @vitest-environment jsdom

import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useParams: () => ({ project_id: '1af3bf84-d5cc-48d7-a02a-0bb4083ab7c2' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/shared/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useAnimationOverview', () => ({ useAnimationOverview: () => ({}) }));
vi.mock('./MissionControlTab', () => ({ MissionControlTab: () => null }));
vi.mock('@/shared/api/actions', () => ({ generateKeyframes: vi.fn() }));

import ProjectDetailPage from './page';

describe('corrupted project workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a failure state instead of No scenario selected', async () => {
    const fixture = readFileSync(
      resolve(process.cwd(), 'src/shared/__fixtures__/beamngtest1-truncated-scenarios.txt'),
      'utf8',
    ).replace(/\r?\n$/, '');
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: '1af3bf84-d5cc-48d7-a02a-0bb4083ab7c2',
        status: 'pending',
        stage: 'init',
        meta: { title: 'beamngtest1', scenarios: fixture },
        createdAt: '2026-07-22T00:00:00.000Z',
      }),
    })));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ProjectDetailPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Scenario data is corrupted')).toBeTruthy();
    expect(screen.queryByText('No scenario selected.')).toBeNull();
    expect(screen.getByText('Create a new project')).toBeTruthy();
  });
});
