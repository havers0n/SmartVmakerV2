"use client";

import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Package, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@project/api-client";

type Batch = {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
};

export default function Batches() {
  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ["batches"],
    queryFn: () => client.hwar.listBatches(),
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Batches</h1>
          <p className="text-sm text-muted-foreground">Run multiple projects from templates</p>
        </div>
        <Button data-testid="button-new-batch">
          <Plus className="w-4 h-4 mr-2" />
          New Batch
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6">
          {[1, 2].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : batches.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No batches yet"
          description="Create batches to run multiple video projects using templates with different parameters"
          action={{
            label: "Create Batch",
            onClick: () => {},
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {batches.map((batch) => (
            <Card key={batch.id} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{batch.kind}</h3>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(batch.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-secondary">
                    {batch.status}
                  </span>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}