"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "../../../../src/components/ui/button";
import { Card } from "../../../../src/components/ui/card";
// import { Badge } from "../../../../src/components/ui/badge"; // Removed unused import
import { ArrowLeft, Play } from "lucide-react";
import { useToast } from "../../../../src/hooks/use-toast";
import { StatusBadge } from "../../../../src/components/ui/status-badge";
import { makeClient } from "@project/api-client";
// import type { Project, ScenarioConceptType } from "@shared/schema";

// Mock data for now
type Project = {
  id: string;
  title: string;
  ratio: string;
  lang: string;
  source: string;
  status: string;
  costUsd?: number;
  prompt?: string;
};

const api = makeClient();

export default function ProjectDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["project", params.id],
    queryFn: async () => {
      try {
        // TODO: Replace with actual API call
        // const data = await api.hwar.getProject(params.id);
        // return data;
        return {
          id: params.id,
          title: "Mock Project",
          ratio: "16:9",
          lang: "en",
          source: "prompt",
          status: "draft",
          costUsd: 0.5,
          prompt: "Sample prompt",
        };
      } catch (error) {
        console.error("Failed to fetch project:", error);
        throw error;
      }
    },
    enabled: !!params.id,
  });

  const generateScenariosMutation = useMutation({
    mutationFn: async () => {
      return api.hwar.generateScenarios(params.id, {
        prompt: project?.prompt || undefined,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Scenarios generated",
        description: `Generated ${data.concepts?.length || 0} scenario concepts`,
      });
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
      <div className="min-h-screen bg-background">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <Card className="p-8 animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-20 bg-muted rounded"></div>
          </Card>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Project not found</h2>
          <p className="text-sm text-muted-foreground mb-4">The project you're looking for doesn't exist</p>
          <Button onClick={() => router.push("/hwar/create")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.push("/hwar/create")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-semibold mb-1">{project.title}</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{project.ratio}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground capitalize">
                {project.lang === "none" ? "No audio" : project.lang}
              </span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground capitalize">{project.source}</span>
            </div>
          </div>
          <StatusBadge status={project.status} />
        </div>

        {project.status === "draft" && (
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Ready to Generate Scenarios</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Click below to generate 5 AI-powered scenario concepts for your video
            </p>
            <Button
              onClick={() => generateScenariosMutation.mutate()}
              disabled={generateScenariosMutation.isPending}
              data-testid="button-generate-scenarios"
            >
              {generateScenariosMutation.isPending ? (
                "Generating..."
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generate Scenarios
                </>
              )}
            </Button>
          </Card>
        )}

        {project.status === "scenarios_generating" && (
          <Card className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Generating Scenarios</h2>
            <p className="text-sm text-muted-foreground">
              AI is creating compelling video concepts for you...
            </p>
          </Card>
        )}

        {(project.status === "scenarios_review" || project.status === "frames_generating") && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Scenarios</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Review and select scenes from the generated scenarios
            </p>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">
                Scenario details and scene selection will be displayed here
              </p>
            </Card>
          </div>
        )}

        {project.costUsd && project.costUsd > 0 && (
          <Card className="p-4 mt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Cost</span>
              <span className="text-lg font-bold font-mono">${project.costUsd.toFixed(2)}</span>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}