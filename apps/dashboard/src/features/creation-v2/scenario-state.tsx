"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { userMessageForError } from "./model";

export function ScenarioState({
  status,
  attempt,
  onStart,
  pending,
}: {
  status: string;
  attempt: any;
  onStart: () => void;
  pending: boolean;
}) {
  if (status === "not_started")
    return (
      <div>
        <p>Scenario not started. The Run is durable and ready to queue.</p>
        <Button className="mt-3" onClick={onStart} disabled={pending}>
          {pending ? "Queueing…" : "Generate scenario"}
        </Button>
      </div>
    );
  if (status === "queued")
    return (
      <div>
        <p className="flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          Attempt {attempt.attemptNumber} is queued and waiting for a worker.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Queued {formatDate(attempt.queuedAt)}. If this remains queued, the
          worker may be unavailable; the Attempt is preserved.
        </p>
      </div>
    );
  if (status === "running")
    return (
      <div>
        <p className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Attempt {attempt.attemptNumber} is running.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Started {formatDate(attempt.startedAt)} · {attempt.provider}/
          {attempt.modelId}. Progress updates when the worker completes; no
          percentage is estimated.
        </p>
      </div>
    );
  if (status === "ready")
    return (
      <p className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        Validated scenario candidates are ready from Attempt{" "}
        {attempt?.attemptNumber}.
      </p>
    );
  if (status === "cancelled")
    return (
      <p className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Scenario generation was cancelled.
      </p>
    );
  return (
    <div>
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertCircle className="h-4 w-4" />
        Scenario generation failed
      </p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Item
          label="Message"
          value={userMessageForError({
            code: attempt?.errorCode,
            message: attempt?.errorMessage,
            correlationId: attempt?.correlationId,
          })}
        />
        <Item label="Error code" value={attempt?.errorCode ?? "UNKNOWN"} />
        <Item label="Attempt" value={String(attempt?.attemptNumber ?? "—")} />
        <Item
          label="Finish reason"
          value={attempt?.finishReason ?? "Not provided"}
        />
        <Item label="Completed" value={formatDate(attempt?.completedAt)} />
      </dl>
      <Button className="mt-4" onClick={onStart} disabled={pending}>
        {pending ? "Queueing retry…" : "Retry with same settings"}
      </Button>
    </div>
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
