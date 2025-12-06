import React from 'react';
import { StartIngestForm } from '@/features/ingest/StartIngestForm';
import { IngestJobsTable } from '@/features/ingest/IngestJobsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Activity, Database, Search } from 'lucide-react';

export default function IngestPage() {
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
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Active Harvesters</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3 Workers</div>
            <p className="text-xs text-muted-foreground">Polling queues every 1s</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingested Today</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">142</div>
            <p className="text-xs text-muted-foreground">+20.1% from yesterday</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Analysis</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">Queue depth normal</p>
          </CardContent>
        </Card>
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