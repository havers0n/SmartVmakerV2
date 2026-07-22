"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { generationV2Api } from "@/features/creation-v2/api";

export default function VideoProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useQuery({
    queryKey: ["video-project", projectId],
    queryFn: () => generationV2Api.getProject(projectId),
  });
  const runs = useQuery({
    queryKey: ["generation-runs", projectId],
    queryFn: () => generationV2Api.listRuns(projectId),
  });
  if (project.isLoading || runs.isLoading)
    return (
      <main className="mx-auto max-w-5xl p-6" role="status">
        Loading Project history…
      </main>
    );
  if (!project.data || project.isError || runs.isError)
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p role="alert">This Project could not be loaded.</p>
      </main>
    );
  const projectRuns = runs.data ?? [];
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <p className="text-sm text-muted-foreground">Video Project</p>
        <h1 className="text-3xl font-bold">{project.data.title}</h1>
        <p className="mt-2">{project.data.idea}</p>
      </header>
      <div className="flex gap-2">
        <Button asChild>
          <Link href={`/hwar/create/v2?projectId=${projectId}`}>
            Create Run
          </Link>
        </Button>
      </div>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Run history</h2>
        {projectRuns.length === 0 ? (
          <Card className="p-6">
            No Runs yet. Project settings are safe; create the first immutable
            Run.
          </Card>
        ) : (
          <div className="space-y-3">
            {projectRuns.map((run) => (
              <Card
                key={run.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <strong>Run #{run.runNumber}</strong>
                  <p className="text-sm text-muted-foreground">
                    Created {new Date(run.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{run.status}</Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/hwar/projects/${projectId}/runs/${run.id}`}>
                      Open Run
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
