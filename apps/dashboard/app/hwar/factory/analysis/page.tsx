"use client";

import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Skeleton } from "@/src/components/ui/skeleton";
import { StatusBadge } from "@/src/components/ui/status-badge";
import { EmptyState } from "@/src/components/ui/empty-state";
import { FlaskConical, RotateCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@project/api-client";

type AnalysisTask = {
  id: string;
  video: {
    title: string;
    duration: number;
  };
  status: string;
  startedAt?: string;
  providerCostUsd?: number;
};

export default function Analysis() {
  const { data: tasks = [], isLoading } = useQuery<AnalysisTask[]>({
    queryKey: ["analysis-tasks"],
    queryFn: () => client.hwar.listAnalysisTasks(),
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Analysis Queue</h1>
          <p className="text-sm text-muted-foreground">Gemini-powered video analysis tasks</p>
        </div>
        <Button variant="outline" data-testid="button-retry-failed">
          <RotateCw className="w-4 h-4 mr-2" />
          Retry Failed
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-12 px-4 text-xs uppercase">Video</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase">Duration</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase">Status</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase">Started</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase text-right">Cost</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i} className="h-14">
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No analysis tasks"
          description="Analysis tasks will appear here when you run a harvest. Each task generates framebreak.json, analytics.json, and report.md for a video."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-12 px-4 text-xs uppercase">Video</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase">Duration</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase">Status</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase">Started</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase text-right">Cost</TableHead>
                <TableHead className="h-12 px-4 text-xs uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task: AnalysisTask) => (
                <TableRow key={task.id} className="h-14">
                  <TableCell className="font-medium">{task.video.title}</TableCell>
                  <TableCell>{task.video.duration}s</TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {task.startedAt ? new Date(task.startedAt).toLocaleTimeString() : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">${task.providerCostUsd?.toFixed(4) || "0.00"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost">View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}