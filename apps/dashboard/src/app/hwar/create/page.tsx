"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Plus, FolderOpen } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { StatusBadge } from "@/shared/components/ui/status-badge";
import { ActionHttpError, listProjects } from "@/shared/api/actions";
import { ProjectPreview } from "@scrimspec/shared-types";
import { type ProjectTabId } from "@/shared/const/projectTabs";


export default function CreateIndex() {
  const router = useRouter();

  const handleCardClick = (id: string, tab?: ProjectTabId) => {
    router.push(tab ? `/hwar/create/${id}?tab=${tab}` : `/hwar/create/${id}`);
  };

  const query = useQuery<ProjectPreview[], Error>({
    queryKey: ["projects"],
    queryFn: listProjects,
  });

  const projects = query.data ?? [];
  const isLoading = query.isLoading;
  const isError = query.isError;
  const error = query.error;

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
        ) : isError ? (
          <Card className="p-8">
            {(() => {
              const status = error instanceof ActionHttpError ? error.status : undefined;
              const title =
                status === 401
                  ? "Session expired"
                  : status === 403
                    ? "Access denied"
                    : "Couldn’t load projects";

              const description =
                status === 401
                  ? "Please sign in again to continue."
                  : status === 403
                    ? "You don’t have permission to view projects. Check your access / RLS policies."
                    : "Check your connection or permissions and try again.";

              const primaryAction = status === 401 || status === 403
                ? { label: "Re-login", onClick: () => router.push("/login") }
                : { label: "Retry", onClick: () => query.refetch() };

              return (
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{description}</p>
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={primaryAction.onClick} variant={status === 401 || status === 403 ? "default" : "default"}>
                      {primaryAction.label}
                    </Button>
                    {status === 401 && (
                      <Button onClick={() => query.refetch()} variant="outline">
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
          </Card>
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
                onClick={() => handleCardClick(project.id)}
                data-testid={`card-project-${project.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{project.title}</h3>
                    <div className="text-xs text-muted-foreground">{new Date(project.createdAt).toLocaleDateString()}</div>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    className="px-3 py-1 rounded-full bg-secondary text-foreground hover:bg-secondary/80"
                    onClick={(e) => { e.stopPropagation(); handleCardClick(project.id, "script"); }}
                  >
                    {project.scenesCount} scenes
                  </button>
                  <button
                    className="px-3 py-1 rounded-full bg-secondary text-foreground hover:bg-secondary/80"
                    onClick={(e) => { e.stopPropagation(); handleCardClick(project.id, "keyframes"); }}
                  >
                    {project.keyframesCount} frames
                  </button>
                  {project.hasFinalVideo && (
                    <button
                      className="px-3 py-1 rounded-full bg-secondary text-foreground hover:bg-secondary/80"
                      onClick={(e) => { e.stopPropagation(); handleCardClick(project.id, "final"); }}
                    >
                      Final video
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}