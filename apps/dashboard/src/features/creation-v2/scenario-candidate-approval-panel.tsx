"use client";
import React, { useRef, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import type { ScenarioCandidate } from "./model";

export function ScenarioCandidateApprovalPanel({ artifactId, candidates, currentRevision, approve }: {
  artifactId: string; candidates: ScenarioCandidate[];
  currentRevision?: { revisionNumber: number; sourceCandidateIndex: number } | null;
  approve: (body: { scenarioArtifactId: string; sourceCandidateIndex: number }, key: string) => Promise<{ revision: { revisionNumber: number; sourceCandidateIndex: number } }>;
}) {
  const [selected, setSelected] = useState<number | null>(currentRevision?.sourceCandidateIndex ?? null);
  const [pending, setPending] = useState(false); const [revision, setRevision] = useState(currentRevision ?? null); const [error, setError] = useState("");
  const key = useRef<string>();
  async function onApprove() { if (selected === null || pending) return; setPending(true); setError(""); key.current ??= `approve:${crypto.randomUUID()}`; try { const result = await approve({ scenarioArtifactId: artifactId, sourceCandidateIndex: selected }, key.current); setRevision(result.revision); key.current = undefined; } catch (e) { setError((e as { code?: unknown })?.code === "IDEMPOTENCY_KEY_REUSED" ? "This approval key was already used for another selection. Try again." : "Scenario approval could not be completed. Please retry."); } finally { setPending(false); } }
  return <section aria-label="Scenario candidate approval" className="space-y-4">
    {revision && <p role="status" className="text-sm text-muted-foreground">Approved revision {revision.revisionNumber} · candidate {revision.sourceCandidateIndex + 1}</p>}
    <div className="grid gap-3">{candidates.map((candidate, index) => <Card key={`${candidate.title}-${index}`} className={`cursor-pointer p-4 ${selected === index ? "ring-2 ring-primary" : ""}`} onClick={() => setSelected(index)}><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">{candidate.title}</h3><p className="text-sm text-muted-foreground">{candidate.description}</p></div><span className="text-sm">{selected === index ? "Selected" : `Candidate ${index + 1}`}</span></div></Card>)}</div>
    <Button onClick={onApprove} disabled={selected === null || pending}>{pending ? "Approving…" : revision ? "Approve as new revision" : "Approve selected scenario"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
