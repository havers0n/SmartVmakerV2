"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { Textarea } from "@/shared/components/ui/textarea";
import { ModelSelector } from "@/shared/components/ai/ModelSelector";
import {
  ActionHttpError,
  listStoryTemplates,
  startGenerationProject,
  type StartGenerationProjectResult,
  type StoryTemplate,
} from "@/shared/api/actions";
import { useToast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { contentFormatsApi, type Format } from "@/features/content-formats/api";
import {
  buildProjectCreationPayload,
  type ProjectSource,
} from "@/features/hwar-create/project-creation-payload";

const ratios = ["16:9", "9:16", "4:3", "3:4"] as const;
const languages = [
  { value: "none", label: "No audio track" },
  { value: "ru", label: "Russian" },
  { value: "en", label: "English" },
  { value: "he", label: "Hebrew" },
  { value: "es", label: "Spanish" },
];
const duration = (format: Format) =>
  format.targetDurationMinSeconds || format.targetDurationMaxSeconds
    ? `${format.targetDurationMinSeconds ?? "?"}–${format.targetDurationMaxSeconds ?? "?"}s`
    : "Not specified";

export default function NewProject() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const initialFormatId =
    params.get("source") === "content_format"
      ? params.get("contentFormatId")
      : null;
  const [step, setStep] = useState(initialFormatId ? 2 : 1);
  const [title, setTitle] = useState("");
  const [ratio, setRatio] = useState<(typeof ratios)[number]>("16:9");
  const [lang, setLang] = useState("none");
  const [source, setSource] = useState<ProjectSource>(
    initialFormatId ? "content_format" : "prompt",
  );
  const [prompt, setPrompt] = useState("");
  const [contentFormatId, setContentFormatId] = useState<string | null>(
    initialFormatId,
  );
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [textModelId, setTextModelId] = useState<string | null>(null);
  const [imageModelId, setImageModelId] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const formatsQuery = useQuery({
    queryKey: ["content-formats", { status: "active", search }],
    queryFn: () =>
      contentFormatsApi.list({ status: "active", search, limit: 100 }),
    enabled: step === 2 || Boolean(initialFormatId),
  });
  const templatesQuery = useQuery<StoryTemplate[]>({
    queryKey: ["storyTemplates"],
    queryFn: listStoryTemplates,
    enabled: step === 2,
  });
  const formats = (formatsQuery.data ?? []).filter(
    (row) => row.format.status === "active",
  );
  const templates = templatesQuery.data ?? [];
  const selectedFormat = useMemo(
    () =>
      formats.find((row) => row.format.id === contentFormatId)?.format ?? null,
    [formats, contentFormatId],
  );
  const selectedTemplate =
    templates.find((template) => template.id === templateId) ?? null;
  useEffect(() => {
    if (initialFormatId && formatsQuery.isSuccess && !selectedFormat)
      setSourceError(
        "This Content Format is unavailable. It may not exist or is no longer active.",
      );
  }, [initialFormatId, formatsQuery.isSuccess, selectedFormat]);
  const changeSource = (value: string) => {
    setSource(value as ProjectSource);
    setSourceError(null);
    if (value !== "content_format") setContentFormatId(null);
    if (value === "prompt") setTemplateId(null);
  };
  const payload = buildProjectCreationPayload({
    source,
    title,
    ratio,
    lang,
    prompt,
    textModelId,
    imageModelId,
    contentFormatId: selectedFormat ? contentFormatId : null,
    templateId,
  });
  const create = useMutation({
    mutationFn: () => {
      setGenerationError(null);
      if (!payload)
        throw new Error(
          "Choose a valid starting point and provide a specific video idea.",
        );
      return startGenerationProject(payload);
    },
    onSuccess: (result: StartGenerationProjectResult) => {
      toast({
        title: "Success",
        description: result.message || "Project created successfully",
      });
      router.push(`/hwar/create/${result.project.id}`);
    },
    onError: (error: Error) => {
      const code = error instanceof ActionHttpError ? error.code : undefined;
      const message = code === "SCENARIO_GENERATION_TRUNCATED"
        ? "The model response was incomplete. Your settings are preserved; retry to generate the scenarios again."
        : code?.startsWith("SCENARIO_GENERATION_")
          ? "The model returned invalid scenario data. Your settings are preserved; please retry."
          : error.message;
      if (/content format.*(draft|archived|not found)/i.test(message)) {
        setSourceError(`${message}. Choose another active Content Format.`);
        setContentFormatId(null);
      }
      if (code?.startsWith("SCENARIO_GENERATION_")) setGenerationError(message);
      toast({
        title: code?.startsWith("SCENARIO_GENERATION_")
          ? "Scenario generation failed"
          : "Could not create project",
        description: message,
        variant: "destructive",
      });
    },
  });
  const next = () => {
    if (step < 3) setStep((value) => value + 1);
    else create.mutate();
  };
  const ideaPlaceholder =
    source === "content_format"
      ? "What happens if Earth loses oxygen for five seconds?"
      : source === "story_template"
        ? "Describe the specific video idea this story structure should implement."
        : "Describe the specific video idea you want to create.";
  const compatible =
    !selectedFormat ||
    !selectedTemplate ||
    ((!selectedFormat.targetDurationMinSeconds ||
      selectedTemplate.targetDurationSeconds >=
        selectedFormat.targetDurationMinSeconds) &&
      (!selectedFormat.targetDurationMaxSeconds ||
        selectedTemplate.targetDurationSeconds <=
          selectedFormat.targetDurationMaxSeconds));
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className={cn(
                "h-2 flex-1 rounded",
                item <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <Card className="rounded-xl border p-5 sm:p-8">
          {step === 1 && (
            <section className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold">Project Details</h1>
                <p className="text-sm text-muted-foreground">
                  Configure your video project
                </p>
              </div>
              <div>
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Motivational Story"
                />
              </div>
              <div>
                <Label>Aspect Ratio</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ratios.map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={ratio === item}
                      onClick={() => setRatio(item)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm",
                        ratio === item &&
                          "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="language">Language</Label>
                <Select value={lang} onValueChange={setLang}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ModelSelector
                type="text-to-text"
                label="Text Generation Model"
                placeholder="Select a text model..."
                value={textModelId}
                onChange={setTextModelId}
              />
              <ModelSelector
                type="text-to-image"
                label="Image Generation Model"
                placeholder="Select an image model..."
                value={imageModelId}
                onChange={setImageModelId}
              />
            </section>
          )}
          {step === 2 && (
            <section>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold">Starting Point</h1>
                <p className="text-sm text-muted-foreground">
                  Choose a production pattern, story structure, or begin with
                  your own idea.
                </p>
              </div>
              <Tabs value={source} onValueChange={changeSource}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="prompt">Prompt</TabsTrigger>
                  <TabsTrigger value="content_format">
                    Content Formats
                  </TabsTrigger>
                  <TabsTrigger value="story_template">
                    Story Templates
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="prompt" className="mt-6">
                  <Idea
                    value={prompt}
                    onChange={setPrompt}
                    placeholder={ideaPlaceholder}
                  />
                </TabsContent>
                <TabsContent value="content_format" className="mt-6 space-y-5">
                  <Input
                    aria-label="Search active Content Formats"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search active Content Formats"
                  />
                  {formatsQuery.isLoading ? (
                    <Loading />
                  ) : formatsQuery.isError ? (
                    <Retry onRetry={() => formatsQuery.refetch()} />
                  ) : formats.length === 0 ? (
                    <Card className="p-6 text-center text-sm text-muted-foreground">
                      No active Content Formats yet.
                      <br />
                      Create and activate a format before using it for a
                      project.
                      <br />
                      <a
                        className="mt-3 inline-block text-primary underline"
                        href="/content-formats"
                      >
                        Browse Content Formats
                      </a>
                    </Card>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {formats.map((row) => (
                        <FormatCard
                          key={row.format.id}
                          row={row}
                          selected={contentFormatId === row.format.id}
                          onSelect={() => {
                            setContentFormatId(row.format.id);
                            setSourceError(null);
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {sourceError && (
                    <p role="alert" className="text-sm text-destructive">
                      {sourceError}
                    </p>
                  )}
                  {selectedFormat && (
                    <Card className="space-y-2 border-primary/40 bg-primary/5 p-4">
                      <div className="flex items-center justify-between">
                        <strong>{selectedFormat.name}</strong>
                        <a
                          className="text-sm text-primary underline"
                          href={`/content-formats/${selectedFormat.id}`}
                        >
                          View format
                        </a>
                      </div>
                      <p className="text-sm">{selectedFormat.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Hook: {selectedFormat.hookPattern || "—"} · Structure:{" "}
                        {selectedFormat.structurePattern || "—"} · Visual:{" "}
                        {selectedFormat.visualPattern || "—"} · Pacing:{" "}
                        {selectedFormat.pacingPattern || "—"} ·{" "}
                        {duration(selectedFormat)}
                      </p>
                    </Card>
                  )}
                  {selectedFormat && (
                    <TemplatePicker
                      templates={templates}
                      loading={templatesQuery.isLoading}
                      selectedId={templateId}
                      onSelect={setTemplateId}
                      optional
                    />
                  )}
                  {!compatible && (
                    <p
                      role="alert"
                      className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                    >
                      This template targets{" "}
                      {selectedTemplate?.targetDurationSeconds}s, outside the
                      Content Format range ({duration(selectedFormat!)}). The
                      Content Format duration remains the primary constraint.
                    </p>
                  )}
                  <Idea
                    value={prompt}
                    onChange={setPrompt}
                    placeholder={ideaPlaceholder}
                  />
                </TabsContent>
                <TabsContent value="story_template" className="mt-6 space-y-5">
                  <TemplatePicker
                    templates={templates}
                    loading={templatesQuery.isLoading}
                    selectedId={templateId}
                    onSelect={setTemplateId}
                  />
                  <Idea
                    value={prompt}
                    onChange={setPrompt}
                    placeholder={ideaPlaceholder}
                  />
                </TabsContent>
              </Tabs>
            </section>
          )}
          {step === 3 && (
            <section className="space-y-4">
              <h1 className="text-2xl font-semibold">Review & Create</h1>
              <p className="text-sm text-muted-foreground">
                Your specific idea is required for every starting point.
              </p>
              <Card className="space-y-2 p-4 text-sm">
                <p>
                  <b>Source:</b>{" "}
                  {source === "content_format"
                    ? selectedFormat?.name
                    : source === "story_template"
                      ? selectedTemplate?.name
                      : "Prompt"}
                </p>
                <p>
                  <b>Idea:</b> {prompt.trim() || "Missing"}
                </p>
                <p>
                  <b>Ratio:</b> {ratio} · <b>Language:</b>{" "}
                  {languages.find((item) => item.value === lang)?.label}
                </p>
              </Card>
              {!payload && (
                <p role="alert" className="text-sm text-destructive">
                  Provide a specific idea and select the required starting point
                  before creating the project.
                </p>
              )}
            </section>
          )}
        </Card>
        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              step === 1
                ? router.push("/hwar/create")
                : setStep((value) => value - 1)
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          <Button
            onClick={next}
            disabled={
              (step === 2 && !payload) ||
              (step === 3 && (!payload || create.isPending))
            }
          >
            {create.isPending
              ? "Creating..."
              : step === 3
                ? generationError ? "Retry" : "Create Project"
                : "Continue"}
            {!create.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
        {generationError && step === 3 && (
          <Card className="mt-4 border-destructive/40 bg-destructive/5 p-4" role="alert">
            <p className="font-medium text-destructive">Scenario generation failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{generationError}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
function Idea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <Label htmlFor="project-idea">Specific video idea</Label>
      <Textarea
        id="project-idea"
        className="mt-2 min-h-28"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        A Content Format or Story Template is not a complete video topic.
      </p>
    </div>
  );
}
function Loading() {
  return (
    <div className="flex justify-center py-10">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
function Retry({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-6 text-center text-sm">
      Could not load active Content Formats.{" "}
      <Button variant="ghost" onClick={onRetry}>
        Retry
      </Button>
    </Card>
  );
}
function FormatCard({
  row,
  selected,
  onSelect,
}: {
  row: { format: Format; videoCount: number; evidenceCount: number };
  selected: boolean;
  onSelect: () => void;
}) {
  const f = row.format;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "rounded-lg border p-4 text-left",
        selected && "ring-2 ring-primary",
      )}
    >
      <div className="flex justify-between gap-2">
        <strong>{f.name}</strong>
        {selected && <Check className="h-4 w-4" />}
      </div>
      <p className="text-xs text-muted-foreground">
        {f.formatType} · {f.description || "No description"}
      </p>
      <p className="mt-2 text-xs">
        Hook: {f.hookPattern || "—"}
        <br />
        Structure: {f.structurePattern || "—"}
        <br />
        Duration: {duration(f)} · {row.videoCount} videos · {row.evidenceCount}{" "}
        evidence
      </p>
    </button>
  );
}
function TemplatePicker({
  templates,
  loading,
  selectedId,
  onSelect,
  optional = false,
}: {
  templates: StoryTemplate[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  optional?: boolean;
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h2 className="font-medium">
            Story Template{optional ? " — Optional" : ""}
          </h2>
          {optional && (
            <p className="text-xs text-muted-foreground">
              Content Format defines the proven production pattern; Story
              Template adds narrative beats.
            </p>
          )}
        </div>
        {optional && selectedId && (
          <Button variant="ghost" onClick={() => onSelect(null)}>
            Clear
          </Button>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : templates.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          No Story Templates available. Create one in the Library first.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={selectedId === t.id}
              onClick={() => onSelect(t.id)}
              className={cn(
                "rounded-lg border p-4 text-left",
                selectedId === t.id && "ring-2 ring-primary",
              )}
            >
              <div className="flex justify-between">
                <strong>{t.name}</strong>
                {selectedId === t.id && <Check className="h-4 w-4" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {t.description || "No description"}
              </p>
              <p className="mt-2 text-xs">
                Target duration: {t.targetDurationSeconds}s · Beats:{" "}
                {t.tags?.join(", ") || "See template"}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
