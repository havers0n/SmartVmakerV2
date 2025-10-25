"use client";

import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Layout, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@project/api-client";

type Template = {
  id: string;
  name: string;
  createdAt: string;
  meta?: Record<string, any>;
};

export default function Templates() {
  const { data: templates = [], isLoading, error, refetch } = useQuery<Template[]>({
    queryKey: ["templates"],
    queryFn: () => client.hwar.listTemplates(),
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Templates</h1>
          <p className="text-sm text-muted-foreground">Pipeline templates for batch production</p>
        </div>
        <Button data-testid="button-new-template">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {error ? (
        <Card className="p-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Failed to load templates</h3>
            <p className="text-sm text-muted-foreground mb-4">{error instanceof Error ? error.message : "An error occurred"}</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-8 w-16" />
              </div>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Layout}
          title="No templates yet"
          description="Create pipeline templates to automate batch video production with consistent settings"
          action={{
            label: "Create Template",
            onClick: () => {},
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Use
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}