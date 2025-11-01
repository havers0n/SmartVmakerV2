"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { ArrowLeft, Sparkles, Loader2, Image as ImageIcon, Check } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { generateKeyframes } from "@/shared/api/actions";
import { R2Image } from "@/shared/components/ui/r2-image";

interface Scene {
  phase: string;
  duration: number;
  description: string;
}

interface Scenario {
  title: string;
  description: string;
  aesScore: number;
  hookStrength: number;
  emotionalCurve: string[];
  scenes: Scene[];
}

interface Project {
  id: string;
  status: string;
  meta: {
    title?: string;
    ratio?: string;
    scenarios?: Scenario[];
    selectedScenarioIndex?: number;
    keyframeGenerationStartedAt?: string;
  };
  createdAt: string;
}

interface Asset {
  id: string;
  assetType: string;
  status: string;
  storageUrl: string;
  meta: {
    sceneIndex?: number;
    frameType?: string;
    phase?: string;
  };
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const projectId = params.project_id as string;

  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number | null>(null);

  // Fetch project data
  const { data: project, isLoading, refetch } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/generation/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return res.json();
    },
    refetchInterval: (data) => {
      // Refetch every 5 seconds if project is processing
      return data?.status === 'processing' ? 5000 : false;
    },
  });

  // Fetch project assets (keyframes)
  const { data: assets = [], refetch: refetchAssets } = useQuery<Asset[]>({
    queryKey: ["project-assets", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/generation/projects/${projectId}/assets`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: (data) => {
      // Keep refetching if there are pending assets
      const hasPending = data?.some(a => a.status === 'pending' || a.status === 'processing');
      return hasPending ? 3000 : false;
    },
    enabled: !!project?.meta?.keyframeGenerationStartedAt,
  });

  // Auto-select first scenario on load
  useEffect(() => {
    if (project?.meta?.scenarios && selectedScenarioIndex === null) {
      setSelectedScenarioIndex(project.meta.selectedScenarioIndex ?? 0);
    }
  }, [project, selectedScenarioIndex]);

  const generateKeyframesMutation = useMutation({
    mutationFn: async () => {
      if (selectedScenarioIndex === null) {
        throw new Error("Please select a scenario first");
      }

      const result = await generateKeyframes({
        projectId,
        selectedScenarioIndex,
      });

      return result;
    },
    onSuccess: (result: any) => {
      toast({
        title: "Success",
        description: result.message || "Keyframe generation started",
      });
      refetch();
      setTimeout(() => refetchAssets(), 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Project not found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/hwar/create")}>
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  const scenarios = project.meta.scenarios || [];
  const selectedScenario = selectedScenarioIndex !== null ? scenarios[selectedScenarioIndex] : null;

  // Group assets by scene
  const assetsByScene = new Map<number, { first?: Asset; last?: Asset }>();
  assets.forEach(asset => {
    const sceneIndex = asset.meta.sceneIndex;
    if (sceneIndex !== undefined) {
      if (!assetsByScene.has(sceneIndex)) {
        assetsByScene.set(sceneIndex, {});
      }
      const sceneAssets = assetsByScene.get(sceneIndex)!;
      if (asset.meta.frameType === 'first') {
        sceneAssets.first = asset;
      } else if (asset.meta.frameType === 'last') {
        sceneAssets.last = asset;
      }
    }
  });

  const hasGeneratedKeyframes = project.meta.keyframeGenerationStartedAt;
  const totalAssets = assets.length;
  const completedAssets = assets.filter(a => a.status === 'completed').length;
  const allComplete = totalAssets > 0 && completedAssets === totalAssets;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/hwar/create")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{project.meta.title || "Untitled Project"}</h1>
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{project.meta.ratio}</Badge>
                <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                  {project.status}
                </Badge>
                {hasGeneratedKeyframes && !allComplete && (
                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Generating {completedAssets}/{totalAssets}
                  </Badge>
                )}
                {allComplete && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    <Check className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scenario Selection */}
        {!hasGeneratedKeyframes && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Select a Scenario</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenarios.map((scenario, index) => (
                <Card
                  key={index}
                  className={cn(
                    "p-4 cursor-pointer transition-all",
                    selectedScenarioIndex === index
                      ? "ring-2 ring-primary bg-primary/5"
                      : "hover:shadow-md"
                  )}
                  onClick={() => setSelectedScenarioIndex(index)}
                >
                  <div className="flex items-start gap-2 mb-3">
                    <Sparkles className={cn(
                      "w-5 h-5 mt-0.5",
                      selectedScenarioIndex === index ? "text-primary" : "text-muted-foreground"
                    )} />
                    <h3 className="font-medium flex-1">{scenario.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {scenario.description}
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">AES Score</span>
                    <span className="text-sm font-medium">{scenario.aesScore.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Hook Strength</span>
                    <span className="text-sm font-medium">{scenario.hookStrength.toFixed(1)}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex gap-1 flex-wrap">
                      {scenario.emotionalCurve.slice(0, 3).map((emotion, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {emotion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {selectedScenarioIndex !== null && (
              <div className="mt-6 flex justify-end">
                <Button
                  size="lg"
                  onClick={() => generateKeyframesMutation.mutate()}
                  disabled={generateKeyframesMutation.isPending}
                >
                  {generateKeyframesMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Jobs...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Generate Keyframes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Keyframe Preview */}
        {selectedScenario && hasGeneratedKeyframes && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Generated Keyframes</h2>
            <div className="space-y-6">
              {selectedScenario.scenes.map((scene, sceneIndex) => {
                const sceneAssets = assetsByScene.get(sceneIndex);
                const firstFrame = sceneAssets?.first;
                const lastFrame = sceneAssets?.last;

                return (
                  <Card key={sceneIndex} className="p-6">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">
                          Scene {sceneIndex + 1}: {scene.phase}
                        </h3>
                        <Badge variant="outline">{scene.duration}s</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{scene.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* First Frame */}
                      <div>
                        <div className="text-xs font-medium mb-2 text-muted-foreground">Opening Frame</div>
                        <div
                          className="relative bg-muted rounded-lg overflow-hidden"
                          style={{
                            aspectRatio: project.meta.ratio === '9:16' ? '9/16' : '16/9',
                          }}
                        >
                          {firstFrame?.status === 'completed' && firstFrame.storageUrl ? (
                            <R2Image
                              r2Key={firstFrame.storageUrl}
                              alt={`Scene ${sceneIndex + 1} - Opening`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {firstFrame?.status === 'processing' || firstFrame?.status === 'pending' ? (
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                              ) : firstFrame?.status === 'failed' ? (
                                <span className="text-xs text-destructive">Failed</span>
                              ) : (
                                <ImageIcon className="w-8 h-8 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Last Frame */}
                      <div>
                        <div className="text-xs font-medium mb-2 text-muted-foreground">Closing Frame</div>
                        <div
                          className="relative bg-muted rounded-lg overflow-hidden"
                          style={{
                            aspectRatio: project.meta.ratio === '9:16' ? '9/16' : '16/9',
                          }}
                        >
                          {lastFrame?.status === 'completed' && lastFrame.storageUrl ? (
                            <R2Image
                              r2Key={lastFrame.storageUrl}
                              alt={`Scene ${sceneIndex + 1} - Closing`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {lastFrame?.status === 'processing' || lastFrame?.status === 'pending' ? (
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                              ) : lastFrame?.status === 'failed' ? (
                                <span className="text-xs text-destructive">Failed</span>
                              ) : (
                                <ImageIcon className="w-8 h-8 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
