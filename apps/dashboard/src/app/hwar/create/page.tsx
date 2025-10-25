"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../src/components/ui/button";
import { Card } from "../../../src/components/ui/card";
import { Plus, FolderOpen } from "lucide-react";
import { EmptyState } from "../../../src/components/ui/empty-state";
import { StatusBadge } from "../../../src/components/ui/status-badge";
// TODO: Import the correct Project type
// import type { Project } from "@shared/schema";

// Mock data for now
type Project = {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  ratio: string;
  lang: string;
  source: string;
  costUsd?: number;
};

// const api = makeClient(); // Commented out since it's not used

export default function CreateIndex() {
  const router = useRouter();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      try {
        // TODO: Replace with actual API call
        // const data = await api.hwar.listProjects();
        // return data;
        return [];
      } catch (error) {
        console.error("Failed to fetch projects:", error);
        return [];
      }
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Projects</h1>
            <p className="text-sm text-muted-foreground">Create and manage video projects</p>
          </div>
          <Button onClick={() => router.push("/hwar/create/new")} data-testid="button-new-project">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Create your first video project using AI-powered scenario generation, presets, or YouTube trends"
            action={{
              label: "Create Project",
              onClick: () => router.push("/hwar/create/new"),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="p-6 hover-elevate cursor-pointer"
                onClick={() => router.push(`/hwar/create/${project.id}`)}
                data-testid={`card-project-${project.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{project.title}</h3>
                    <div className="text-xs text-muted-foreground">{new Date(project.createdAt).toLocaleDateString()}</div>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{project.ratio}</span>
                  <span>•</span>
                  <span className="capitalize">{project.lang === "none" ? "No audio" : project.lang}</span>
                  <span>•</span>
                  <span className="capitalize">{project.source}</span>
                </div>
                {project.costUsd && project.costUsd > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground">
                      Cost: <span className="font-mono font-medium text-foreground">${project.costUsd.toFixed(2)}</span>
                    </div>
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