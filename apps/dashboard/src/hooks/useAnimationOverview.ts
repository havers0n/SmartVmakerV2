import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AnimationOverviewResponse } from '@scrimspec/hwar-core/types/generation';

export interface UseAnimationOverviewResult {
  overview: AnimationOverviewResponse | undefined;
  isLoading: boolean;
  error: unknown;
  refresh: () => void;
  hasProcessingJobs: boolean;
}

export function useAnimationOverview(projectId: string | undefined): UseAnimationOverviewResult {
  const query = useQuery<AnimationOverviewResponse, Error>({
    queryKey: ['animation-overview', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await fetch(`/api/generation/projects/${projectId}/animation`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load animation overview (${res.status})`);
      }
      return res.json() as Promise<AnimationOverviewResponse>;
    },
    // React Query v5 passes the Query object here (not the raw `data`).
    refetchInterval: (q) => {
      const jobs = q.state.data?.jobs ?? [];
      const hasProcessing = jobs.some(
        (job) => job.status === 'pending' || job.status === 'running',
      );
      return hasProcessing ? 5000 : false;
    },
  });

  const hasProcessingJobs = useMemo(() => {
    const jobs = query.data?.jobs ?? [];
    return jobs.some((job) => job.status === 'pending' || job.status === 'running');
  }, [query.data?.jobs]);

  const refresh = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    overview: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refresh,
    hasProcessingJobs,
  };
}

