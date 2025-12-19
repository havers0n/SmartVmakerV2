'use client';

import React, { useEffect, useState } from 'react';
import { StartIngestForm } from '@/features/ingest/StartIngestForm';
import { IngestJobsTable } from '@/features/ingest/IngestJobsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Activity, Database, Search } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { formatNumber } from '@/shared/lib/locale';

type IngestOverview = {
  activeWorkers: number;
  ingestedToday: number;
  pendingAnalysis: number;
};

export default function IngestPage() {
  const [overview, setOverview] = useState<IngestOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadOverview = async () => {
      setLoadingOverview(true);
      try {
        const res = await fetch('/api/hwar/ingest/overview', { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Failed to load overview (${res.status})`);
        }
        const data = await res.json();
        setOverview(data);
        setOverviewError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load ingest overview:', err);
        setOverview(null);
        setOverviewError('Error loading');
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOverview(false);
        }
      }
    };

    loadOverview();

    return () => controller.abort();
  }, []);

  const renderMetric = (
    title: string,
    value: number | undefined,
    description: string,
    Icon: typeof Activity
  ) => {
    const showSkeleton = loadingOverview;
    const isError = !!overviewError;
    const hasData = value !== undefined && value !== null;

    return (
      <Card className={title === 'Active Harvesters' ? 'bg-primary/5 border-primary/20' : undefined}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={`text-sm font-medium ${title === 'Active Harvesters' ? 'text-primary' : ''}`}>
            {title}
          </CardTitle>
          <Icon className={`h-4 w-4 ${title === 'Active Harvesters' ? 'text-primary' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          {showSkeleton ? (
            <Skeleton className="h-8 w-24" />
          ) : isError ? (
            <div className="text-sm text-destructive">Error loading</div>
          ) : hasData ? (
            <>
              <div className="text-2xl font-bold">{formatNumber(value as number)}</div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">No data</div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Content Discovery</h1>
        <p className="text-muted-foreground">
          Harvest, enrich, and prepare video assets for the production pipeline.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {renderMetric('Active Harvesters', overview?.activeWorkers, 'Polling ingest queue', Activity)}
        {renderMetric('Ingested Today', overview?.ingestedToday, 'New videos ingested in the last 24h', Database)}
        {renderMetric('Pending Analysis', overview?.pendingAnalysis, 'Awaiting analysis processing', Search)}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Input */}
        <div className="lg:col-span-1 space-y-6">
           <Card className="border-primary/20 shadow-lg shadow-primary/5">
             <CardHeader>
               <CardTitle>New Harvest</CardTitle>
             </CardHeader>
             <CardContent>
               <StartIngestForm />
             </CardContent>
           </Card>

           <Card className="bg-muted/30">
            <CardContent className="p-6">
               <h3 className="font-semibold mb-2 text-sm text-foreground">How it works</h3>
               <ul className="space-y-2 text-xs text-muted-foreground">
                 <li className="flex gap-2">
                   <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">1</span>
                   Search triggers the Ingest Worker
                 </li>
                 <li className="flex gap-2">
                   <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">2</span>
                   Enrichment Worker fetches metadata (views, likes)
                 </li>
                 <li className="flex gap-2">
                   <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">3</span>
                   Video becomes available for Deep Analysis
                 </li>
               </ul>
            </CardContent>
           </Card>
        </div>

        {/* Right Column: Queue Table */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Ingest Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <IngestJobsTable />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}