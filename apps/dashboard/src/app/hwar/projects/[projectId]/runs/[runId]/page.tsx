"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { generationV2Api } from "@/features/creation-v2/api";
import {
  newIdempotencyKey,
  scenarioPollInterval,
  userMessageForError,
} from "@/features/creation-v2/model";
import { ScenarioState } from "@/features/creation-v2/scenario-state";
import { ScenarioCandidateApprovalPanel } from "@/features/creation-v2/scenario-candidate-approval-panel";

export default function GenerationRunPage() {
  const { projectId, runId } = useParams<{
    projectId: string;
    runId: string;
  }>();
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState("");
  const actionKey = useRef<string>();
  const project = useQuery({
    queryKey: ["video-project", projectId],
    queryFn: () => generationV2Api.getProject(projectId),
  });
  const run = useQuery({
    queryKey: ["generation-run", projectId, runId],
    queryFn: () => generationV2Api.getRun(projectId, runId),
    refetchInterval: (query) => {
      return scenarioPollInterval(
        query.state.data?.scenarioExecution?.status,
        typeof document !== "undefined" && document.hidden,
      );
    },
    refetchIntervalInBackground: false,
  });
  const status = run.data?.scenarioExecution?.status;
  const artifact = useQuery({
    queryKey: ["scenario-artifact", projectId, runId],
    queryFn: () => generationV2Api.artifact(projectId, runId),
    enabled: status === "ready",
    retry: false,
  });
  const currentApproval = useQuery({
    queryKey: ["current-approved-scenario", projectId, runId],
    queryFn: () => generationV2Api.currentApprovedScenario(projectId, runId),
    enabled: status === "ready",
    retry: false,
  });

  const startAttempt = async () => {
    if (retrying) return;
    setRetrying(true);
    setActionError("");
    actionKey.current ??= newIdempotencyKey("retry");
    try {
      await generationV2Api.enqueueAttempt(projectId, runId, actionKey.current);
      actionKey.current = undefined;
      await run.refetch();
    } catch (error) {
      setActionError(
        userMessageForError({
          code:
            typeof error === "object" && error
              ? String((error as any).code ?? "")
              : undefined,
          message: error instanceof Error ? error.message : undefined,
          correlationId:
            typeof error === "object" && error
              ? String((error as any).requestId ?? "")
              : undefined,
        }),
      );
    } finally {
      setRetrying(false);
    }
  };

  if (project.isLoading || run.isLoading)
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p role="status" className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading durable Run…
        </p>
      </main>
    );
  if (project.isError || run.isError || !project.data || !run.data)
    return (
      <main className="mx-auto max-w-5xl p-6">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Run could not be loaded</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Check that the URL is correct and that you own this Project.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              project.refetch();
              run.refetch();
            }}
          >
            Retry
          </Button>
        </Card>
      </main>
    );

  const execution = run.data.scenarioExecution;
  const attempt = execution.latestAttempt;
  const input = record(run.data.inputSnapshot);
  const production = record(input.production);
  const models = record(input.models);
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Video Project</p>
          <h1 className="text-3xl font-bold">{project.data.title}</h1>
          <p className="mt-2 max-w-3xl text-sm">{project.data.idea}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => run.refetch()}
            disabled={run.isRefetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${run.isRefetching ? "animate-spin" : ""}`}
            />
            Refresh status
          </Button>
          <Button asChild variant="outline">
            <Link href={`/hwar/projects/${projectId}`}>Run history</Link>
          </Button>
        </div>
      </header>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Run #{run.data.runNumber}</h2>
            <p className="text-sm text-muted-foreground">
              Immutable snapshot · created {formatDate(run.data.createdAt)}
            </p>
          </div>
          <StatusBadge status={execution.status} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <Item
            label="Production"
            value={`${production.ratio ?? "—"} · ${production.targetDurationSeconds ?? "—"}s · ${production.platform ?? "—"}`}
          />
          <Item
            label="Text model"
            value={`${record(models.text).provider ?? "—"}/${record(models.text).modelId ?? "—"}`}
          />
          <Item
            label="Audio / language"
            value={`${production.audioMode ?? "—"} · ${production.language ?? "—"}`}
          />
        </dl>
      </Card>
      <Card className="p-5">
        <h2 className="text-xl font-semibold">Scenario generation</h2>
        <div className="mt-4" aria-live="polite">
          <ScenarioState
            status={execution.status}
            attempt={attempt}
            onStart={startAttempt}
            pending={retrying}
          />
        </div>
        {actionError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {actionError}
          </p>
        )}
      </Card>
      {status === "ready" && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Scenario candidates</h2>
          {artifact.isLoading ? (
            <p role="status">Validating scenario artifact…</p>
          ) : artifact.isError ? (
            <Card className="border-destructive p-5">
              <h3 className="font-semibold text-destructive">
                Scenario result is inconsistent
              </h3>
              <p role="alert" className="mt-2 text-sm text-destructive">
                The Run reports ready, but a validated scenario artifact is not
                available. Refresh the status or contact support with the
                request ID.{" "}
                {artifact.error instanceof Error ? artifact.error.message : ""}
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {artifact.data && (
                <ScenarioCandidateApprovalPanel
                  artifactId={artifact.data.id}
                  candidates={artifact.data.scenarios}
                  currentRevision={currentApproval.data ?? null}
                  approve={async (body, key) => {
                    const result = await generationV2Api.approveScenario(
                      projectId,
                      runId,
                      body,
                      key,
                    );
                    await currentApproval.refetch();
                    return result;
                  }}
                />
              )}
              {artifact.data?.scenarios.map((scenario, index) => (
                <Card key={`${scenario.title}-${index}`} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {scenario.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {scenario.description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">AES {scenario.aesScore}</Badge>
                      <Badge variant="outline">
                        Hook {scenario.hookStrength}
                      </Badge>
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                    <Item
                      label="Emotional curve"
                      value={scenario.emotionalCurve.join(" → ")}
                    />
                    <Item
                      label="Scenes"
                      value={String(scenario.scenes.length)}
                    />
                    <Item
                      label="Estimated duration"
                      value={`${scenario.scenes.reduce((sum, scene) => sum + scene.duration, 0)}s`}
                    />
                  </dl>
                  <details className="mt-4 rounded-md border p-3">
                    <summary className="cursor-pointer font-medium">
                      Scene list
                    </summary>
                    <ol className="mt-3 space-y-3">
                      {scenario.scenes.map((scene, sceneIndex) => (
                        <li
                          key={`${scene.phase}-${sceneIndex}`}
                          className="border-l-2 pl-3"
                        >
                          <p className="font-medium">
                            {sceneIndex + 1}. {scene.phase} · {scene.duration}s
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {scene.description}
                          </p>
                          {scene.cameraCommands?.length ? (
                            <p className="mt-1 text-xs">
                              Camera: {scene.cameraCommands.join("; ")}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </details>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/hwar/create/v2?projectId=${projectId}&runId=${runId}`}>
            Change settings and create new run
          </Link>
        </Button>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={
        status === "failed"
          ? "destructive"
          : status === "ready"
            ? "default"
            : "secondary"
      }
    >
      {status.replace("_", " ")}
    </Badge>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Not available";
}
function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
