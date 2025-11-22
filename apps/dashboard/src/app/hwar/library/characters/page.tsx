"use client";

import { useState } from "react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Users2, Plus, Edit, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/shared/hooks/use-toast";
import {
  listCharacters,
  deleteCharacter,
} from "@/shared/api/actions";
import { CreateCharacterDialog } from "./components/CreateCharacterDialog";
import { EditCharacterDialog } from "./components/EditCharacterDialog";
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

type Character = {
  id: string;
  name: string;
  description: string | null;
  stylePresets: Record<string, unknown> | null;
  referenceImageUrls: string[] | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function Characters() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [deletingCharacter, setDeletingCharacter] = useState<Character | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: characters = [], isLoading, error, refetch } = useQuery<Character[]>({
    queryKey: ["characters"],
    queryFn: listCharacters,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCharacter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      toast({
        title: "Success",
        description: "Character deleted successfully",
      });
      setDeletingCharacter(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete character",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Characters</h1>
          <p className="text-sm text-muted-foreground">
            Manage character references for consistent video generation
          </p>
        </div>
        <Button data-testid="button-new-character" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Character
        </Button>
      </div>

      {error ? (
        <Card className="p-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Failed to load characters</h3>
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
          {[1, 2].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-16 w-16 rounded-full bg-muted"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-muted rounded"></div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="h-3 bg-muted rounded w-1/4 mb-2"></div>
                  <div className="h-10 bg-muted rounded"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : characters.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="No characters yet"
          description="Create character profiles with reference images and style rules for consistent appearance across videos"
          action={{
            label: "Create Character",
            onClick: () => setIsCreateDialogOpen(true),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((character) => (
            <Card key={character.id} className="p-6" data-testid={`card-character-${character.id}`}>
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={character.referenceImageUrls?.[0]}
                    alt={character.name}
                  />
                  <AvatarFallback>{character.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold mb-1">{character.name}</h3>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingCharacter(character)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingCharacter(character)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {character.description && (
                    <p className="text-sm text-muted-foreground">{character.description}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {character.stylePresets &&
                  Object.keys(character.stylePresets).length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        Style Presets
                      </div>
                      <div className="text-xs bg-muted p-2 rounded max-h-20 overflow-y-auto">
                        {Object.entries(character.stylePresets).map(([key, value]) => (
                          <div key={key} className="mb-1">
                            <span className="font-medium">{key}:</span>{" "}
                            {typeof value === "string" ? value : JSON.stringify(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {character.referenceImageUrls && character.referenceImageUrls.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Reference Images ({character.referenceImageUrls.length})
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {character.referenceImageUrls.slice(0, 3).map((url, idx) => (
                        <div
                          key={idx}
                          className="w-12 h-12 rounded border bg-muted overflow-hidden"
                        >
                          <img
                            src={url}
                            alt={`Reference ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                      {character.referenceImageUrls.length > 3 && (
                        <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">
                            +{character.referenceImageUrls.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(character.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateCharacterDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {/* Edit Dialog */}
      {editingCharacter && (
        <EditCharacterDialog
          open={!!editingCharacter}
          onOpenChange={(open) => !open && setEditingCharacter(null)}
          character={editingCharacter}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingCharacter}
        onOpenChange={(open) => !open && setDeletingCharacter(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Character?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCharacter?.name}"? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCharacter && deleteMutation.mutate(deletingCharacter.id)}
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