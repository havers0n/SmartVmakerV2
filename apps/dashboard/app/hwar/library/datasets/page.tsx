"use client";

import { Card } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { EmptyState } from "@/src/components/ui/empty-state";
import { FolderOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@project/api-client";

type Dataset = {
  id: string;
  name: string;
  createdAt: string;
};

export default function Datasets() {
  const { data: datasets = [], isLoading } = useQuery<Dataset[]>({
    queryKey: ["datasets"],
    queryFn: () => client.hwar.listDatasets(),
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Datasets</h1>
        <p className="text-sm text-muted-foreground">Browse harvest data, analysis documents, and signals</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : datasets.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No datasets yet"
          description="Datasets will be created automatically when you run harvests and analyze videos"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {datasets.map((dataset) => (
            <Card key={dataset.id} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{dataset.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(dataset.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-muted-foreground hover:text-foreground">View</button>
                  <button className="text-sm text-muted-foreground hover:text-foreground">Download</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}