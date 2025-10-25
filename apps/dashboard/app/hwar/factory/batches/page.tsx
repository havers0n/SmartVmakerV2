"use client";

import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Badge } from "@/src/components/ui/badge";
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
  const { data: batches = [], isLoading, error, refetch } = useQuery<Batch[]>({
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

      {error ? (
        <Card className="p-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Failed to load batches</h3>
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
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
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
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="font-medium">{batch.kind}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{batch.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(batch.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">
                      View
                    </Button>
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