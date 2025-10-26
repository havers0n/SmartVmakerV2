"use client";

import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@project/api-client";

type Queue = {
  id: string;
  name: string;
  size: number;
  updatedAt: string;
};

export default function Queues() {
  const { data: queues = [], isLoading, error, refetch } = useQuery<Queue[]>({
    queryKey: ["queues"],
    queryFn: () => client.hwar.listQueues(),
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Job Queues</h1>
        <p className="text-sm text-muted-foreground">Monitor all tasks across the pipeline</p>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="scenario">Scenarios</TabsTrigger>
          <TabsTrigger value="frames">Frames</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {error ? (
            <Card className="p-8">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Failed to load queues</h3>
                <p className="text-sm text-muted-foreground mb-4">{error instanceof Error ? error.message : "An error occurred"}</p>
                <Button onClick={() => refetch()} variant="outline">
                  Retry
                </Button>
              </div>
            </Card>
          ) : isLoading ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4].map((i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : queues.length === 0 ? (
            <EmptyState
              icon={List}
              title="No queued tasks"
              description="Tasks will appear here as projects and harvests generate jobs"
            />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queues.map((queue: Queue) => (
                    <TableRow key={queue.id}>
                      <TableCell className="font-medium">{queue.name}</TableCell>
                      <TableCell>{queue.size}</TableCell>
                      <TableCell>{new Date(queue.updatedAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}