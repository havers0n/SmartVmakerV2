"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Plus, Search, Sparkles, Upload } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";

type Niche = {
  id: string;
  name: string;
  slug: string;
  language: string;
  maxChannelAgeMonths: number;
};

type NicheQuery = {
  id: string;
  nicheId: string;
  query: string;
  isEnabled: boolean;
};

type DiscoveryRun = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: string;
  errorMessage: string | null;
};
type QueryGenerationResult = {
  created: NicheQuery[];
  skipped: Array<{ query: string }>;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

export default function DiscoveryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkSummary, setBulkSummary] =
    useState<{
      added: number;
      skippedDuplicates: number;
      skippedEmpty: number;
      errors: number;
    }>();
  const [generationResult, setGenerationResult] =
    useState<QueryGenerationResult>();

  const nichesQuery = useQuery<Niche[]>({
    queryKey: ["niches"],
    queryFn: () => api("/api/niches"),
  });
  const niches = nichesQuery.data ?? [];

  useEffect(() => {
    if (!selectedId && niches[0]) setSelectedId(niches[0].id);
  }, [niches, selectedId]);

  const selectedNicheQuery = useQuery<Niche>({
    queryKey: ["niches", selectedId],
    queryFn: () => api(`/api/niches/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const queriesQuery = useQuery<NicheQuery[]>({
    queryKey: ["niches", selectedId, "queries"],
    queryFn: () => api(`/api/niches/${selectedId}/queries`),
    enabled: Boolean(selectedId),
  });
  const runsQuery = useQuery<DiscoveryRun[]>({
    queryKey: ["discovery-runs", selectedId],
    queryFn: () => api(`/api/discovery-runs?nicheId=${selectedId}`),
    enabled: Boolean(selectedId),
    refetchInterval: (query) =>
      query.state.data?.some((run) => run.status === "running") ? 3000 : false,
  });

  const createNiche = useMutation({
    mutationFn: (values: { name: string; slug: string }) =>
      api<Niche>("/api/niches", {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: (niche) => {
      queryClient.invalidateQueries({ queryKey: ["niches"] });
      setSelectedId(niche.id);
      setName("");
      setSlug("");
    },
  });

  const addQuery = useMutation({
    mutationFn: (query: string) =>
      api<NicheQuery>(`/api/niches/${selectedId}/queries`, {
        method: "POST",
        body: JSON.stringify({ query }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["niches", selectedId, "queries"],
      });
      setNewQuery("");
    },
  });

  const addBulkQueries = useMutation({
    mutationFn: (queries: string[]) =>
      api<{
        added: NicheQuery[];
        skippedDuplicates: string[];
        skippedEmpty: number;
        errors: Array<{ query: string; reason: string }>;
      }>(`/api/niches/${selectedId}/queries/bulk`, {
        method: "POST",
        body: JSON.stringify({ queries }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["niches", selectedId, "queries"],
      });
      setBulkSummary({
        added: result.added.length,
        skippedDuplicates: result.skippedDuplicates.length,
        skippedEmpty: result.skippedEmpty,
        errors: result.errors.length,
      });
      setBulkInput("");
    },
  });

  const toggleQuery = useMutation({
    mutationFn: ({ id, isEnabled }: Pick<NicheQuery, "id" | "isEnabled">) =>
      api<NicheQuery>(`/api/niche-queries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isEnabled }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["niches", selectedId, "queries"],
      }),
  });

  const generateQueries = useMutation({
    mutationFn: () =>
      api<QueryGenerationResult>(`/api/niches/${selectedId}/generate-queries`, {
        method: "POST",
      }),
    onSuccess: (result) => {
      setGenerationResult(result);
      queryClient.invalidateQueries({
        queryKey: ["niches", selectedId, "queries"],
      });
    },
  });

  const runDiscovery = useMutation({
    mutationFn: () =>
      api<DiscoveryRun>("/api/discovery-runs", {
        method: "POST",
        body: JSON.stringify({ nicheId: selectedId }),
      }),
    onSuccess: (run) => {
      queryClient.invalidateQueries({
        queryKey: ["discovery-runs", selectedId],
      });
      router.push(`/discovery/runs/${run.id}`);
    },
    onError: () =>
      queryClient.invalidateQueries({
        queryKey: ["discovery-runs", selectedId],
      }),
  });

  function submitNiche(event: FormEvent) {
    event.preventDefault();
    createNiche.mutate({ name, slug });
  }

  function submitQuery(event: FormEvent) {
    event.preventDefault();
    if (selectedId) addQuery.mutate(newQuery);
  }

  function submitBulkQueries() {
    if (!selectedId || !bulkInput.trim()) return;
    const lines = bulkInput
      .split(/\n/)
      .map((l) => l.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    addBulkQueries.mutate(lines);
  }

  const selectedNiche = selectedNicheQuery.data;
  const error =
    nichesQuery.error ??
    createNiche.error ??
    queriesQuery.error ??
    addQuery.error ??
    toggleQuery.error;
  const queryError = error ?? generateQueries.error;
  const pageError = queryError ?? runsQuery.error ?? runDiscovery.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <Search className="h-6 w-6 text-primary" /> Niche Discovery
        </h1>
        <p className="mt-2 text-muted-foreground">
          Configure niches and the YouTube queries used to discover them.
        </p>
      </div>

      {pageError && (
        <p className="text-sm text-destructive">{pageError.message}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Niches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {nichesQuery.isLoading && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
              {niches.map((niche) => (
                <Button
                  key={niche.id}
                  variant={selectedId === niche.id ? "secondary" : "ghost"}
                  className="h-auto w-full justify-start py-3 text-left"
                  onClick={() => setSelectedId(niche.id)}
                >
                  <span>
                    <span className="block">{niche.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {niche.slug}
                    </span>
                  </span>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create niche</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={submitNiche}>
                <div className="space-y-2">
                  <Label htmlFor="niche-name">Name</Label>
                  <Input
                    id="niche-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="niche-slug">Slug</Label>
                  <Input
                    id="niche-slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="simulation-games"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                  />
                </div>
                <Button className="w-full" disabled={createNiche.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create niche
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>{selectedNiche?.name ?? "Select a niche"}</CardTitle>
              {selectedNiche && (
                <Button
                  onClick={() => runDiscovery.mutate()}
                  disabled={
                    runDiscovery.isPending ||
                    !queriesQuery.data?.some((query) => query.isEnabled)
                  }
                >
                  <Play className="mr-2 h-4 w-4" />
                  {runDiscovery.isPending ? "Running…" : "Run discovery"}
                </Button>
              )}
            </div>
            {selectedNiche && (
              <CardDescription>
                {selectedNiche.language} · channels up to{" "}
                {selectedNiche.maxChannelAgeMonths} months old
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedNiche && (
              <div className="space-y-3">
                <form className="flex gap-2" onSubmit={submitQuery}>
                  <Input
                    aria-label="New discovery query"
                    value={newQuery}
                    onChange={(e) => setNewQuery(e.target.value)}
                    placeholder="Add a discovery query"
                    required
                  />
                  <Button disabled={addQuery.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </form>

                <div className="space-y-2">
                  <Textarea
                    aria-label="Bulk queries"
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder={
                      "Paste queries, one per line:\nearth stopped spinning shorts\ngravity disappeared shorts\nhumans disappeared animation"
                    }
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={addBulkQueries.isPending || !bulkInput.trim()}
                      onClick={submitBulkQueries}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {addBulkQueries.isPending
                        ? "Adding…"
                        : "Add queries"}
                    </Button>
                    {bulkInput && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setBulkInput("");
                          setBulkSummary(undefined);
                        }}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  {bulkSummary && (
                    <div className="text-sm space-y-0.5">
                      <p className="text-green-600 dark:text-green-400">
                        Added {bulkSummary.added} quer{bulkSummary.added === 1 ? "y" : "ies"}
                      </p>
                      {bulkSummary.skippedDuplicates > 0 && (
                        <p className="text-muted-foreground">
                          Skipped {bulkSummary.skippedDuplicates} duplicate{bulkSummary.skippedDuplicates === 1 ? "" : "s"}
                        </p>
                      )}
                      {bulkSummary.skippedEmpty > 0 && (
                        <p className="text-muted-foreground">
                          Skipped {bulkSummary.skippedEmpty} empty line{bulkSummary.skippedEmpty === 1 ? "" : "s"}
                        </p>
                      )}
                      {bulkSummary.errors > 0 && (
                        <p className="text-destructive">
                          {bulkSummary.errors} error{bulkSummary.errors === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  disabled={generateQueries.isPending}
                  onClick={() => generateQueries.mutate()}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {generateQueries.isPending
                    ? "Generating queries…"
                    : "Generate queries"}
                </Button>
                {generationResult && (
                  <div className="text-sm">
                    <p>
                      Created:{" "}
                      {generationResult.created
                        .map((item) => item.query)
                        .join(", ") || "none"}
                    </p>
                    {generationResult.skipped.length > 0 && (
                      <p className="text-muted-foreground">
                        Skipped duplicates:{" "}
                        {generationResult.skipped
                          .map((item) => item.query)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="divide-y rounded-md border">
              {(queriesQuery.data ?? []).map((query) => (
                <div
                  key={query.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <Label
                    htmlFor={`query-${query.id}`}
                    className={
                      query.isEnabled
                        ? ""
                        : "text-muted-foreground line-through"
                    }
                  >
                    {query.query}
                  </Label>
                  <Switch
                    id={`query-${query.id}`}
                    checked={query.isEnabled}
                    disabled={toggleQuery.isPending}
                    onCheckedChange={(isEnabled) =>
                      toggleQuery.mutate({ id: query.id, isEnabled })
                    }
                  />
                </div>
              ))}
              {selectedNiche &&
                !queriesQuery.isLoading &&
                !queriesQuery.data?.length && (
                  <p className="p-4 text-sm text-muted-foreground">
                    No queries yet.
                  </p>
                )}
            </div>

            {selectedNiche && (
              <div className="space-y-3">
                <h2 className="font-semibold">Latest discovery runs</h2>
                <div className="divide-y rounded-md border">
                  {(runsQuery.data ?? []).map((run) => (
                    <Link
                      key={run.id}
                      href={`/discovery/runs/${run.id}`}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
                    >
                      <span className="text-sm">
                        {new Date(run.createdAt).toLocaleString()}
                      </span>
                      <span
                        className={
                          run.status === "failed"
                            ? "text-sm text-destructive"
                            : "text-sm capitalize"
                        }
                      >
                        {run.status}
                      </span>
                    </Link>
                  ))}
                  {!runsQuery.isLoading && !runsQuery.data?.length && (
                    <p className="p-4 text-sm text-muted-foreground">
                      No discovery runs yet.
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
