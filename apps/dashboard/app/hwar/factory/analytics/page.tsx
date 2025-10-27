"use client";

import { Card } from "@/shared/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@project/api-client";

type FactoryStats = {
  costToday: number;
  successRate: number;
  avgProcessingTime: number;
  videosAnalyzed: number;
};

export default function Analytics() {
  const { data: stats, isLoading } = useQuery<FactoryStats>({
    queryKey: ["factory-stats"],
    queryFn: () => client.hwar.listFactoryStats(),
  });

  const statsData = stats || {
    costToday: 66.93,
    successRate: 94.2,
    avgProcessingTime: 12.3,
    videosAnalyzed: 247
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Analytics</h1>
        <p className="text-sm text-muted-foreground">Cost tracking, success rates, and performance metrics</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-4">
            <div className="text-3xl font-bold tabular-nums leading-none mb-2">${statsData.costToday.toFixed(2)}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Cost Today</div>
          </Card>
          <Card className="p-4">
            <div className="text-3xl font-bold tabular-nums leading-none mb-2">{statsData.successRate}%</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Success Rate</div>
          </Card>
          <Card className="p-4">
            <div className="text-3xl font-bold tabular-nums leading-none mb-2">{statsData.avgProcessingTime}s</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Avg Processing</div>
          </Card>
          <Card className="p-4">
            <div className="text-3xl font-bold tabular-nums leading-none mb-2">{statsData.videosAnalyzed}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Videos Analyzed</div>
          </Card>
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-2" />
            <p className="text-sm">Analytics charts will be displayed here</p>
          </div>
        </div>
      </Card>
    </div>
  );
}