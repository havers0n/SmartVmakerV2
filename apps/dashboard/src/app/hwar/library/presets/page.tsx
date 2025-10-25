"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BookMarked, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@project/api-client";

type Preset = {
  id: string;
  name: string;
  description: string;
  theme: string;
  emotions: string[];
  examplePrompt: string;
  createdAt: string;
  meta?: Record<string, any>;
};

export default function Presets() {
  const { data: presets = [], isLoading, error, refetch } = useQuery<Preset[]>({
    queryKey: ["presets"],
    queryFn: () => client.hwar.listPresets(),
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Story Presets</h1>
          <p className="text-sm text-muted-foreground">Reusable templates for consistent video production</p>
        </div>
        <Button data-testid="button-new-preset">
          <Plus className="w-4 h-4 mr-2" />
          New Preset
        </Button>
      </div>

      {error ? (
        <Card className="p-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Failed to load presets</h3>
            <p className="text-sm text-muted-foreground mb-4">{error instanceof Error ? error.message : "An error occurred"}</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-muted rounded mb-4"></div>
              <div className="space-y-3">
                <div>
                  <div className="h-3 bg-muted rounded w-1/4 mb-2"></div>
                  <div className="h-6 bg-muted rounded"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : presets.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="No presets yet"
          description="Create story presets with predefined themes, emotions, and narrative structures"
          action={{
            label: "Create Preset",
            onClick: () => {},
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {presets.map((preset) => (
            <Card key={preset.id} className="p-6 hover-elevate cursor-pointer" data-testid={`card-preset-${preset.id}`}>
              <h3 className="text-lg font-semibold mb-2">{preset.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{preset.description}</p>
              
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Theme</div>
                  <Badge variant="secondary">{preset.theme}</Badge>
                </div>
                
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Emotions</div>
                  <div className="flex gap-1 flex-wrap">
                    {preset.emotions?.map((emotion) => (
                      <Badge key={emotion} variant="outline" className="text-xs capitalize">
                        {emotion}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Example Structure</div>
                  <p className="text-xs bg-muted p-2 rounded">{preset.examplePrompt || preset.meta?.examplePrompt}</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t flex gap-2">
                <Button size="sm" variant="outline" className="flex-1">Edit</Button>
                <Button size="sm" className="flex-1">Use Preset</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}