"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Users2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { client } from "@project/api-client";

type Character = {
  id: string;
  name: string;
  description: string;
  referenceImages?: string[];
  styleRules: string;
  tags: string[];
  createdAt: string;
  meta?: Record<string, any>;
};

export default function Characters() {
  const { data: characters = [], isLoading, error, refetch } = useQuery<Character[]>({
    queryKey: ["characters"],
    queryFn: () => client.hwar.listCharacters(),
  });

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Characters</h1>
          <p className="text-sm text-muted-foreground">Manage character references for consistent video generation</p>
        </div>
        <Button data-testid="button-new-character">
          <Plus className="w-4 h-4 mr-2" />
          New Character
        </Button>
      </div>

      {error ? (
        <Card className="p-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Failed to load characters</h3>
            <p className="text-sm text-muted-foreground mb-4">{error instanceof Error ? error.message : "An error occurred"}</p>
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
            onClick: () => {},
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((character) => (
            <Card key={character.id} className="p-6" data-testid={`card-character-${character.id}`}>
              <div className="flex items-start gap-4 mb-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={character.referenceImages?.[0]} alt={character.name} />
                  <AvatarFallback>{character.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{character.name}</h3>
                  <p className="text-sm text-muted-foreground">{character.description}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Style Rules</div>
                  <p className="text-xs bg-muted p-2 rounded">{character.styleRules}</p>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Tags</div>
                  <div className="flex gap-1 flex-wrap">
                    {character.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex gap-2">
                <Button size="sm" variant="outline" className="flex-1">Edit</Button>
                <Button size="sm" className="flex-1">Use</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}