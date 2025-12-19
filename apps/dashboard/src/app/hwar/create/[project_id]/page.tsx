"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { ArrowLeft, Sparkles, Loader2, Image as ImageIcon, Check, Trash2 } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { generateKeyframes } from "@/shared/api/actions";
import { Skeleton } from "@/shared/components/ui/skeleton";
import Image from "next/image";
import { PROJECT_TABS, type ProjectTabId } from "@/shared/const/projectTabs";
import { MissionControlTab } from "./MissionControlTab";
import { useAnimationOverview } from "@/hooks/useAnimationOverview";

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

export interface GenerationAsset {
  id: string;
  project_id: string;
  asset_type: 'keyframe';
  storage_url: string | null;
  public_url: string | null;
  meta: {
    sceneIndex: number;
    frameType: 'first' | 'last';
  };
  created_at: string;
  status: string;
}

function groupAssetsByScene(assets: GenerationAsset[]) {
  const groups: Record<number, GenerationAsset[]> = {};
  for (const asset of assets) {
    const scene = asset.meta.sceneIndex;
    if (!groups[scene]) groups[scene] = [];
    groups[scene].push(asset);
  }
  return groups;
}

function TabBar({ activeTab, onTabChange }: { activeTab: ProjectTabId; onTabChange: (tab: ProjectTabId) => void }) {
  return (
    <div className="flex gap-2 border-b border-border mb-8">
      {PROJECT_TABS.map((tab) => (
        <button
          key={tab.id}
          className={cn(
            "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === tab.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // Получаем projectId, он может быть строкой, массивом или undefined
  const projectIdParam = params.project_id;
  // Убеждаемся, что у нас есть одна строка
  const projectId = Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam;

  const tabParam = searchParams?.get("tab") as ProjectTabId | null;
  const isValidTab = PROJECT_TABS.some((tab) => tab.id === tabParam);
  const activeTab: ProjectTabId = isValidTab ? tabParam! : "script";

  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number | null>(null);
  const [lastClipRequestAt, setLastClipRequestAt] = useState<Record<number, number>>({});
  const [pendingScene, setPendingScene] = useState<number | null>(null);
  const COOLDOWN_MS = 30_000;

  // --- ВОТ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ---
  // Если у нас еще нет projectId, мы не можем ничего делать дальше.
  // Показываем заглушку и ждем следующего рендера.
  if (!projectId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // --------------------------------

  // Fetch project data
  const { data: project, isLoading, refetch } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/generation/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      return res.json();
    },
    // Теперь useQuery не будет запускаться с undefined в queryKey
    enabled: !!projectId, // Явно указываем, что запрос можно делать только когда есть projectId
    refetchInterval: (query) => {
      // Refetch every 5 seconds if project is processing
      const data = query.state.data;
      return data && 'status' in data && data.status === 'processing' ? 5000 : false;
    },
  });

  // Fetch project assets (keyframes)
  const { data: assets = [], refetch: refetchAssets, isLoading: isAssetsLoading } = useQuery<GenerationAsset[]>({
    queryKey: ["project-assets", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/generation/projects/${projectId}/assets`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      // --- ВОТ ИСПРАВЛЕНИЕ ---
      // Убеждаемся, что data - это массив, прежде чем вызывать .some()
      if (!Array.isArray(data)) {
        return false;
      }
      // -----------------------
      const hasPending = data.some(a => a.status === 'pending' || a.status === 'processing');
      return hasPending ? 3000 : false;
    },
    enabled: !!project?.meta?.keyframeGenerationStartedAt,
  });

  const animationOverview = useAnimationOverview(projectId);

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

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/generation/projects/${projectId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete project");
      }

      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
      });

      router.push("/hwar/create");
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTabChange = (tabId: ProjectTabId) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", tabId);
    const query = params.toString();
    router.push(query ? `/hwar/create/${projectId}?${query}` : `/hwar/create/${projectId}`);
  };

  const handleGenerateAnimation = async (sceneIndex: number) => {
    if (!projectId) return;

    const now = Date.now();
    const last = lastClipRequestAt[sceneIndex] ?? 0;
    const diff = now - last;
    const isOnCooldown = diff < COOLDOWN_MS;
    const remainingSeconds = Math.max(0, Math.ceil((COOLDOWN_MS - diff) / 1000));
    if (isOnCooldown) {
      toast({
        title: "Please wait",
        description: `Wait ${remainingSeconds}s before starting a new clip for this scene.`,
        variant: "destructive",
      });
      return;
    }

    setLastClipRequestAt((prev) => ({ ...prev, [sceneIndex]: now }));
    setPendingScene(sceneIndex);

    try {
      const res = await fetch(`/api/generation/projects/${projectId}/animation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneIndex }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.status === 429) {
        toast({
          title: "Rate limited",
          description:
            json?.message ||
            "You can start a new clip for this scene only once every 30 seconds.",
          variant: "destructive",
        });
        setLastClipRequestAt((prev) => ({ ...prev, [sceneIndex]: Date.now() }));
        return;
      }

      if (!res.ok) {
        throw new Error(json?.error || `Failed to start animation (${res.status})`);
      }

      toast({
        title: "Animation started",
        description: "MiniMax job created. Track progress in Mission Control.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to start animation",
        variant: "destructive",
      });
    } finally {
      setPendingScene(null);
    }
  };

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
  const scenes = groupAssetsByScene(assets);

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
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
            </Button>
          </div>
        </div>

        <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

        {activeTab === "script" && (
          <>
            {hasGeneratedKeyframes && (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Scenario locked because keyframes already generated
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Select a Scenario</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenarios.map((scenario, index) => {
                  const isSelected = selectedScenarioIndex === index;
                  const isLocked = hasGeneratedKeyframes;
                  return (
                    <Card
                      key={index}
                      className={cn(
                        "p-4 transition-all",
                        isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:shadow-md",
                        isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                      )}
                      onClick={!isLocked ? () => setSelectedScenarioIndex(index) : undefined}
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <Sparkles
                          className={cn(
                            "w-5 h-5 mt-0.5",
                            isSelected ? "text-primary" : "text-muted-foreground"
                          )}
                        />
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
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {hasGeneratedKeyframes
                    ? "Scenario selection is locked because keyframes already generated."
                    : "Select a scenario to generate keyframes."}
                </div>
                {(() => {
                  const isGenerateKeyframesDisabled =
                    Boolean(hasGeneratedKeyframes) ||
                    generateKeyframesMutation.isPending ||
                    selectedScenarioIndex === null;

                  return (
                    <Button
                      size="lg"
                      onClick={() => generateKeyframesMutation.mutate()}
                      disabled={isGenerateKeyframesDisabled}
                    >
                  {hasGeneratedKeyframes ? (
                    <>
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Keyframes already generated
                    </>
                  ) : generateKeyframesMutation.isPending ? (
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
                  );
                })()}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Scenario Preview</h3>
              <div className="rounded-lg border bg-muted/30 p-4 max-h-96 overflow-y-auto">
                {selectedScenario ? (
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium">{selectedScenario.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedScenario.description}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {selectedScenario.emotionalCurve.map((emotion, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {emotion}
                        </Badge>
                      ))}
                    </div>
                    {selectedScenario.scenes?.length ? (
                      <div className="space-y-2">
                        {selectedScenario.scenes.map((scene, idx) => (
                          <div key={idx} className="rounded-md border p-3 bg-background">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">
                                Scene {idx + 1}: {scene.phase}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {scene.duration}s
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{scene.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No detailed beats available for this scenario.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No scenario selected.</p>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === "keyframes" && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Keyframes</h2>
                <p className="text-sm text-muted-foreground">
                  Preview of generated keyframes grouped by scene.
                </p>
              </div>
            </div>

            {isAssetsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-[200px] w-full rounded-lg" />
                ))}
              </div>
            )}

            {!isAssetsLoading && Object.keys(scenes).length === 0 && (
              <div className="text-center py-12 border rounded-lg bg-muted/10">
                <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  No keyframes generated yet.
                </p>
              </div>
            )}

            {!isAssetsLoading && Object.keys(scenes).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(scenes)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([sceneIndex, sceneAssets]) => {
                    const firstFrame = sceneAssets.find(a => a.meta.frameType === 'first');
                    const lastFrame = sceneAssets.find(a => a.meta.frameType === 'last');

                    return (
                      <Card key={sceneIndex} className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">Scene {Number(sceneIndex) + 1}</p>
                          {(() => {
                            const last = lastClipRequestAt[Number(sceneIndex)] ?? 0;
                            const remainingSeconds = Math.max(
                              0,
                              Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000),
                            );
                            const disabledByCooldown = remainingSeconds > 0;
                            const isPending = pendingScene === Number(sceneIndex);
                            return (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleGenerateAnimation(Number(sceneIndex))}
                                disabled={isPending || disabledByCooldown}
                              >
                                {isPending
                                  ? "Starting..."
                                  : disabledByCooldown
                                    ? `Wait ${remainingSeconds}s`
                                    : "Generate Clip (MiniMax)"}
                              </Button>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {/* First Frame */}
                          <div className="space-y-1">
                            <div className="relative aspect-video bg-muted rounded-md overflow-hidden border">
                              {firstFrame?.public_url ? (
                                <Image
                                  src={firstFrame.public_url}
                                  alt={`Scene ${Number(sceneIndex) + 1} - First`}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">First</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Last Frame */}
                          <div className="space-y-1">
                            <div className="relative aspect-video bg-muted rounded-md overflow-hidden border">
                              {lastFrame?.public_url ? (
                                <Image
                                  src={lastFrame.public_url}
                                  alt={`Scene ${Number(sceneIndex) + 1} - Last`}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">Last</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {activeTab === "mission" && <MissionControlTab projectId={projectId} />}

        {activeTab === "final" && (
          <div className="space-y-4 mt-8">
            {!animationOverview.overview?.jobs?.length && (
              <p className="text-sm text-muted-foreground">
                No animation jobs yet. Generate a clip from the Keyframes tab.
              </p>
            )}

            {animationOverview.overview?.jobs?.map((job) => (
              <Card key={job.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    Scene {job.sceneIndex !== null ? job.sceneIndex + 1 : "Global"} • {job.status}
                  </div>
                </div>

                {job.status === 'succeeded' && job.videoUrl && (
                  <video
                    src={job.videoUrl}
                    controls
                    className="w-full rounded-md"
                  />
                )}

                {job.status === 'failed' && (
                  <div className="text-xs text-destructive">
                    {job.errorMessage ?? 'Failed to generate video'}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
