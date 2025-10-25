"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Slider } from "@/src/components/ui/slider";
import { Badge } from "@/src/components/ui/badge";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Play, Pause } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { client } from "@project/api-client";

type Worker = {
  id: string;
  name: string;
  type: string;
  isOnline: boolean;
  isPaused: boolean;
  concurrency: number;
  dailyLimitUsd: number;
  status?: string;
  stats?: {
    processed?: number;
    failed?: number;
    costToday?: number;
  };
};

export default function Workers() {
  const queryClient = useQueryClient();
  const { data: workers = [], isLoading } = useQuery<Worker[]>({
    queryKey: ["workers"],
    queryFn: () => client.hwar.listWorkers(),
  });

  const updateWorkerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Worker> }) => {
      return client.hwar.updateWorker(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
    },
  });

  const togglePause = (id: string, isPaused: boolean) => {
    updateWorkerMutation.mutate({ 
      id, 
      data: { status: isPaused ? "active" : "paused" } 
    });
  };

  const updateConcurrency = (id: string, value: number[]) => {
    updateWorkerMutation.mutate({ id, data: { concurrency: value[0] } });
  };

  const updateDailyLimit = (id: string, value: number[]) => {
    updateWorkerMutation.mutate({ id, data: { dailyLimitUsd: value[0] } });
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Workers</h1>
        <p className="text-sm text-muted-foreground">Manage worker concurrency and budgets</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
                <div className="pt-4 border-t grid grid-cols-3 gap-2">
                  <div>
                    <Skeleton className="h-6 w-12 mx-auto mb-1" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                  <div>
                    <Skeleton className="h-6 w-12 mx-auto mb-1" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                  <div>
                    <Skeleton className="h-6 w-12 mx-auto mb-1" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => {
            const stats = worker.stats || { processed: 0, failed: 0, costToday: 0 };
            
            return (
              <Card key={worker.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn(
                        "h-3 w-3 rounded-full",
                        worker.isOnline && !worker.isPaused ? "bg-green-500" : "bg-gray-400"
                      )} />
                      <h3 className="font-semibold">{worker.name}</h3>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize">{worker.type?.replace(/_/g, " ")}</Badge>
                  </div>
                  <Button
                    size="icon"
                    variant={worker.isPaused ? "default" : "outline"}
                    onClick={() => togglePause(worker.id, worker.isPaused || false)}
                    disabled={updateWorkerMutation.isPending}
                    data-testid={`button-toggle-${worker.id}`}
                  >
                    {worker.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">Concurrency</label>
                      <span className="text-sm font-medium tabular-nums">{worker.concurrency}</span>
                    </div>
                    <Slider
                      value={[worker.concurrency]}
                      onValueChange={(v) => updateConcurrency(worker.id, v)}
                      min={1}
                      max={10}
                      step={1}
                      className="cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">Daily Limit</label>
                      <span className="text-sm font-medium tabular-nums">${worker.dailyLimitUsd}</span>
                    </div>
                    <Slider
                      value={[worker.dailyLimitUsd]}
                      onValueChange={(v) => updateDailyLimit(worker.id, v)}
                      min={10}
                      max={200}
                      step={10}
                      className="cursor-pointer"
                    />
                  </div>

                  <div className="pt-4 border-t grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold tabular-nums">{stats.processed || 0}</div>
                      <div className="text-xs text-muted-foreground">Processed</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold tabular-nums">{stats.failed || 0}</div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold tabular-nums">${(stats.costToday || 0).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">Today</div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}