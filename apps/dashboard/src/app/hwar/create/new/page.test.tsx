// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  startGenerationProject: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/shared/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/shared/components/ai/ModelSelector', () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));
vi.mock('@/features/content-formats/api', () => ({
  contentFormatsApi: { list: vi.fn(async () => []) },
}));
vi.mock('@/shared/api/actions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/actions')>();
  return {
    ...actual,
    listStoryTemplates: vi.fn(async () => []),
    startGenerationProject: mocks.startGenerationProject,
  };
});

import { ActionHttpError } from '@/shared/api/actions';
import NewProject from './page';

describe('new project retry state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ trends: [] }),
    })));
  });

  it('keeps wizard fields and re-enables submit after generation failure', async () => {
    mocks.startGenerationProject.mockRejectedValueOnce(new ActionHttpError({
      action: 'generation.startProject',
      status: 502,
      code: 'SCENARIO_GENERATION_TRUNCATED',
      message: 'The model response was incomplete.',
    }));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <NewProject />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('Project Title'), { target: { value: 'My crash video' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Specific video idea'), { target: { value: 'A yellow bus test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    await screen.findByText('Scenario generation failed');
    const retry = screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement;
    expect(retry.textContent).toContain('Retry');
    expect(retry.disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect((screen.getByLabelText('Specific video idea') as HTMLTextAreaElement).value).toBe('A yellow bus test');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect((screen.getByLabelText('Project Title') as HTMLInputElement).value).toBe('My crash video');
    await waitFor(() => expect(mocks.push).not.toHaveBeenCalled());
  });
});
