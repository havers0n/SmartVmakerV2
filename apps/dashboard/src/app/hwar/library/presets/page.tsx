"use client";

import { useState } from "react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { BookMarked, Plus, Edit, Trash2, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/shared/hooks/use-toast";
import {
  listStoryTemplates,
  deleteStoryTemplate,
} from "@/shared/api/actions";
import { CreateStoryTemplateDialog } from "./components/CreateStoryTemplateDialog";
import { EditStoryTemplateDialog } from "./components/EditStoryTemplateDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

type StoryTemplate = {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  targetDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export default function Presets() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StoryTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<StoryTemplate | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: templates = [], isLoading, error, refetch } = useQuery<StoryTemplate[]>({
    queryKey: ["storyTemplates"],
    queryFn: listStoryTemplates,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStoryTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storyTemplates"] });
      toast({
        title: "Success",
        description: "Story template deleted successfully",
      });
      setDeletingTemplate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Story Presets</h1>
          <p className="text-sm text-muted-foreground">
            Reusable narrative templates with beats, emotions, and story structure
          </p>
        </div>
        <Button data-testid="button-new-preset" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Preset
        </Button>
      </div>

      {error ? (
        <Card className="p-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Failed to load presets</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "An error occurred"}
            </p>
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
      ) : templates.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="No presets yet"
          description="Create story presets with predefined beats, emotions, and narrative structures"
          action={{
            label: "Create Preset",
            onClick: () => setIsCreateDialogOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="p-6 hover-elevate cursor-pointer"
              data-testid={`card-preset-${template.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold flex-1">{template.name}</h3>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingTemplate(template)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingTemplate(template)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {template.description && (
                <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {formatDuration(template.targetDurationSeconds)}
                  </span>
                </div>

                {template.tags && template.tags.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">Tags</div>
                    <div className="flex gap-1 flex-wrap">
                      {template.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateStoryTemplateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {/* Edit Dialog */}
      {editingTemplate && (
        <EditStoryTemplateDialog
          open={!!editingTemplate}
          onOpenChange={(open) => !open && setEditingTemplate(null)}
          template={editingTemplate}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTemplate} onOpenChange={(open) => !open && setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Story Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTemplate?.name}"? This action cannot be undone
              and will also delete all beats associated with this template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTemplate && deleteMutation.mutate(deletingTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
