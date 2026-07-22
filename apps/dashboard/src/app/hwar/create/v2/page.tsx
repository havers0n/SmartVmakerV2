"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { ModelSelector } from "@/shared/components/ai/ModelSelector";
import { useToast } from "@/shared/hooks/use-toast";
import {
  getStoryTemplateById,
  listModels,
  listStoryTemplates,
  type ModelWithProvider,
  type StoryTemplate,
} from "@/shared/api/actions";
import { contentFormatsApi, type Format } from "@/features/content-formats/api";
import { FormatInputsRenderer } from "@/features/creation-v2/format-inputs";
import { generationV2Api } from "@/features/creation-v2/api";
import {
  buildProjectRequest,
  buildRunRequest,
  defaultsForInputSchema,
  modelReference,
  newIdempotencyKey,
  parseFormatInputSchema,
  resolveDuration,
  scenarioTextModels,
  userMessageForError,
  validateWizard,
} from "@/features/creation-v2/model";
import type { FormatInputs } from "@scrimspec/shared-types";

type LocalState = {
  step: number;
  contentFormatId: string;
  title: string;
  idea: string;
  storyTemplateId: string;
  formatInputs: FormatInputs;
  production: {
    ratio: "16:9" | "9:16" | "4:3" | "3:4" | "1:1";
    targetDurationSeconds: number;
    language: string;
    platform:
      | "youtube"
      | "youtube_shorts"
      | "tiktok"
      | "instagram_reels"
      | "other";
    audioMode: "none" | "music" | "voiceover" | "music_and_voiceover";
  };
  modelIds: { text: string; image: string; video: string };
  submissionId?: string;
  durableProjectId?: string;
  durableRunId?: string;
};

const initialState = (contentFormatId = ""): LocalState => ({
  step: 1,
  contentFormatId,
  title: "",
  idea: "",
  storyTemplateId: "",
  formatInputs: {},
  production: {
    ratio: "9:16",
    targetDurationSeconds: 32,
    language: "none",
    platform: "youtube_shorts",
    audioMode: "none",
  },
  modelIds: { text: "", image: "", video: "" },
});

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export default function CreationWizardV2Page() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const queryFormatId = params.get("contentFormatId") ?? "";
  const sourceProjectId = params.get("projectId") ?? "";
  const sourceRunId = params.get("runId") ?? "";
  const storageKey = `hwar:creation-wizard-v2:${sourceProjectId || queryFormatId || "new"}`;
  const [state, setState] = useState(() => initialState(queryFormatId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [stage, setStage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const restored = useRef(false);
  const cloneLoaded = useRef(false);

  const formatsQuery = useQuery({
    queryKey: ["content-formats", { status: "active", limit: 100 }],
    queryFn: () => contentFormatsApi.list({ status: "active", limit: 100 }),
  });
  const templatesQuery = useQuery<StoryTemplate[]>({
    queryKey: ["storyTemplates"],
    queryFn: listStoryTemplates,
  });
  const templateQuery = useQuery({
    queryKey: ["storyTemplate", state.storyTemplateId],
    queryFn: () => getStoryTemplateById(state.storyTemplateId),
    enabled: Boolean(state.storyTemplateId),
  });
  const textModels = useQuery({
    queryKey: ["models", "text-to-text"],
    queryFn: () => listModels("text-to-text"),
  });
  const imageModels = useQuery({
    queryKey: ["models", "text-to-image"],
    queryFn: () => listModels("text-to-image"),
  });
  const videoModels = useQuery({
    queryKey: ["models", "image-to-video"],
    queryFn: () => listModels("image-to-video"),
  });
  const sourceProject = useQuery({
    queryKey: ["video-project", sourceProjectId],
    queryFn: () => generationV2Api.getProject(sourceProjectId),
    enabled: Boolean(sourceProjectId),
  });
  const sourceRun = useQuery({
    queryKey: ["generation-run", sourceProjectId, sourceRunId],
    queryFn: () => generationV2Api.getRun(sourceProjectId, sourceRunId),
    enabled: Boolean(sourceProjectId && sourceRunId),
  });

  const formats = (formatsQuery.data ?? []).filter(
    (row) => row.format.status === "active",
  );
  const selectedFormat =
    formats.find((row) => row.format.id === state.contentFormatId)?.format ??
    null;
  const selectedTemplate =
    (templatesQuery.data ?? []).find(
      (template) => template.id === state.storyTemplateId,
    ) ?? null;
  const inputSchema = parseFormatInputSchema(selectedFormat?.inputSchema);
  const availableTextModels = scenarioTextModels(textModels.data ?? []);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const draft = JSON.parse(saved) as Partial<LocalState>;
        setState({
          ...initialState(queryFormatId),
          ...draft,
          contentFormatId: queryFormatId || draft.contentFormatId || "",
        });
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [queryFormatId, storageKey]);

  useEffect(() => {
    if (!restored.current) return;
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (state.title || state.idea || state.contentFormatId)
        event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.contentFormatId, state.idea, state.title]);

  useEffect(() => {
    if (!inputSchema.success && selectedFormat)
      console.warn("creation_wizard_unsupported_schema");
  }, [inputSchema.success, selectedFormat]);

  useEffect(() => {
    if (cloneLoaded.current || !sourceProject.data || !sourceRun.data) return;
    cloneLoaded.current = true;
    const input = record(sourceRun.data.inputSnapshot);
    const production = record(input.production);
    const models = record(input.models);
    setState((old) => ({
      ...old,
      contentFormatId: sourceProject.data.contentFormatId ?? "",
      title: sourceProject.data.title ?? "",
      idea: sourceProject.data.idea ?? "",
      storyTemplateId: sourceProject.data.storyTemplateId ?? "",
      formatInputs: record(input.formatInputs) as FormatInputs,
      production: { ...old.production, ...production },
      modelIds: {
        text: record(models.text).modelId ?? "",
        image: record(models.image).modelId ?? "",
        video: record(models.video).modelId ?? "",
      },
      durableProjectId: sourceProjectId,
      durableRunId: undefined,
      submissionId: undefined,
    }));
  }, [sourceProject.data, sourceProjectId, sourceRun.data]);

  useEffect(() => {
    if (sourceRunId || cloneLoaded.current || !sourceProject.data) return;
    cloneLoaded.current = true;
    const defaults = record(sourceProject.data.projectDefaults);
    const production = record(defaults.production);
    const models = record(defaults.models);
    setState((old) => ({
      ...old,
      contentFormatId: sourceProject.data.contentFormatId ?? "",
      title: sourceProject.data.title ?? "",
      idea: sourceProject.data.idea ?? "",
      storyTemplateId: sourceProject.data.storyTemplateId ?? "",
      formatInputs: record(defaults.formatInputs) as FormatInputs,
      production: { ...old.production, ...production },
      modelIds: {
        text: record(models.text).modelId ?? "",
        image: record(models.image).modelId ?? "",
        video: record(models.video).modelId ?? "",
      },
      durableProjectId: sourceProjectId,
    }));
  }, [sourceProject.data, sourceProjectId, sourceRunId]);

  useEffect(() => {
    const defaults: Array<
      [keyof LocalState["modelIds"], ModelWithProvider | undefined]
    > = [
      [
        "text",
        availableTextModels.find((model) => model.isDefault) ??
          availableTextModels[0],
      ],
      [
        "image",
        (imageModels.data ?? []).find((model) => model.isDefault) ??
          imageModels.data?.[0],
      ],
      [
        "video",
        (videoModels.data ?? []).find((model) => model.isDefault) ??
          videoModels.data?.[0],
      ],
    ];
    setState((old) => {
      const next = { ...old.modelIds };
      let changed = false;
      for (const [kind, model] of defaults)
        if (!next[kind] && model) {
          next[kind] = model.id;
          changed = true;
        }
      return changed ? { ...old, modelIds: next } : old;
    });
  }, [availableTextModels, imageModels.data, videoModels.data]);

  const resolvedValue = useMemo(() => {
    const text = modelReference(
      (textModels.data ?? []).find((model) => model.id === state.modelIds.text),
    );
    const image = modelReference(
      (imageModels.data ?? []).find(
        (model) => model.id === state.modelIds.image,
      ),
    );
    const video = modelReference(
      (videoModels.data ?? []).find(
        (model) => model.id === state.modelIds.video,
      ),
    );
    if (!text || !image || !video) return null;
    return {
      contentFormatId: state.contentFormatId,
      title: state.title,
      idea: state.idea,
      storyTemplateId: state.storyTemplateId || null,
      formatInputs: state.formatInputs,
      production: state.production,
      models: { text, image, video },
    };
  }, [imageModels.data, state, textModels.data, videoModels.data]);

  const validation = resolvedValue
    ? validateWizard(
        resolvedValue,
        selectedFormat,
        selectedTemplate?.targetDurationSeconds,
      )
    : null;
  const duration = selectedFormat
    ? resolveDuration({
        requested: state.production.targetDurationSeconds,
        format: selectedFormat,
        templateDuration: selectedTemplate?.targetDurationSeconds,
      })
    : null;

  const selectFormat = (format: Format) => {
    const schema = parseFormatInputSchema(format.inputSchema);
    const defaults = record(format.productionDefaults);
    setState((old) => ({
      ...old,
      contentFormatId: format.id,
      formatInputs: schema.success ? defaultsForInputSchema(schema.data) : {},
      production: { ...old.production, ...defaults },
      submissionId: undefined,
      durableProjectId: sourceProjectId || undefined,
      durableRunId: undefined,
    }));
    setErrors({});
  };

  const showValidation = () => {
    if (!validation || validation.success) return true;
    const mapped: Record<string, string> = {};
    for (const issue of validation.error.issues)
      mapped[issue.path.join(".")] = issue.message;
    setErrors(mapped);
    requestAnimationFrame(() => {
      const first = validation.error.issues[0]?.path;
      const id =
        first?.[0] === "formatInputs"
          ? `format-input-${first[1]}`
          : first?.join("-");
      if (id) document.getElementById(id)?.focus();
    });
    return false;
  };

  const next = () => {
    if (state.step === 1 && !selectedFormat) {
      setErrors({ contentFormatId: "Choose an active Content Format." });
      document.querySelector<HTMLElement>("[data-format-card]")?.focus();
      return;
    }
    if (
      state.step === 2 &&
      (!state.title.trim() ||
        state.idea.trim().length < 10 ||
        !inputSchema.success)
    ) {
      if (!state.title.trim())
        setErrors({ title: "Project title is required." });
      else if (state.idea.trim().length < 10)
        setErrors({ idea: "Describe a concrete video idea." });
      else
        setErrors({
          formatInputs:
            "This Content Format uses an unsupported input field type.",
        });
      return;
    }
    if (state.step === 3 && (!duration?.valid || !resolvedValue)) {
      setErrors({
        "production.targetDurationSeconds":
          duration && !duration.valid
            ? duration.message
            : "Choose all required models.",
      });
      return;
    }
    setErrors({});
    setState((old) => ({ ...old, step: Math.min(4, old.step + 1) }));
  };

  const submit = async () => {
    if (submitting || !resolvedValue || !showValidation()) return;
    setSubmitting(true);
    setSubmitError("");
    const submissionId = state.submissionId ?? newIdempotencyKey("submit");
    setState((old) => ({ ...old, submissionId }));
    let projectId = state.durableProjectId || sourceProjectId;
    let runId = state.durableRunId;
    try {
      if (projectId && sourceProjectId) {
        setStage("Saving project settings");
        const { clientSubmissionId: _submission, ...projectUpdate } =
          buildProjectRequest(resolvedValue, submissionId);
        await generationV2Api.updateProject(projectId, projectUpdate);
      } else if (!projectId) {
        setStage("Creating video project");
        const project = await generationV2Api.createProject(
          buildProjectRequest(resolvedValue, submissionId),
        );
        projectId = project.id;
        setState((old) => ({ ...old, durableProjectId: projectId }));
      }
      if (!projectId) throw new Error("The durable Project ID is unavailable.");
      if (!runId) {
        setStage("Creating immutable generation run");
        const run = await generationV2Api.createRun(
          projectId,
          buildRunRequest(resolvedValue, submissionId),
        );
        runId = run.id;
        setState((old) => ({
          ...old,
          durableProjectId: projectId,
          durableRunId: runId,
        }));
      }
      if (!runId) throw new Error("The durable Run ID is unavailable.");
      setStage("Queueing scenario attempt");
      try {
        await generationV2Api.enqueueAttempt(
          projectId,
          runId,
          `attempt:${submissionId}`,
        );
      } catch (error) {
        toast({
          title: "Scenario was not queued",
          description:
            "The Project and Run are safe. Start generation from the Run page.",
          variant: "destructive",
        });
      }
      sessionStorage.removeItem(storageKey);
      router.push(`/hwar/projects/${projectId}/runs/${runId}`);
    } catch (error) {
      setSubmitError(
        userMessageForError({
          code: record(error).code,
          message:
            error instanceof Error
              ? error.message
              : "The request could not be completed.",
          correlationId: record(error).requestId,
        }),
      );
    } finally {
      setSubmitting(false);
      setStage("");
    }
  };

  const stepNames = [
    "Content Format",
    "Video Idea",
    "Production Settings",
    "Review & Generate",
  ];
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-medium text-primary">Creation Wizard V2</p>
        <h1 className="text-3xl font-bold">Create a durable video run</h1>
        <p className="mt-2 text-muted-foreground">
          Your scenario runs asynchronously and remains available after refresh.
        </p>
      </header>
      <ol
        className="mb-8 grid gap-2 sm:grid-cols-4"
        aria-label="Creation steps"
      >
        {stepNames.map((name, index) => (
          <li
            key={name}
            aria-current={state.step === index + 1 ? "step" : undefined}
            className={`rounded-md border p-3 text-sm ${state.step === index + 1 ? "border-primary bg-primary/5" : ""}`}
          >
            <span className="mr-2 font-semibold">{index + 1}</span>
            {name}
          </li>
        ))}
      </ol>
      <Card className="p-5 sm:p-8">
        {state.step === 1 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold">
                Choose a Content Format
              </h2>
              <p className="text-sm text-muted-foreground">
                Only active formats available to you can start a V2 run.
              </p>
            </div>
            {formatsQuery.isLoading ? (
              <Loading text="Loading Content Formats" />
            ) : formatsQuery.isError ? (
              <ErrorState
                text="Could not load active Content Formats."
                retry={() => formatsQuery.refetch()}
              />
            ) : formats.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center">
                <p>No active Content Formats are available.</p>
                <Button asChild variant="outline" className="mt-4">
                  <Link href="/content-formats">Manage Content Formats</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {formats.map(({ format }) => (
                  <button
                    data-format-card
                    key={format.id}
                    type="button"
                    onClick={() => selectFormat(format)}
                    aria-pressed={state.contentFormatId === format.id}
                    className={`rounded-lg border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${state.contentFormatId === format.id ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong>{format.name}</strong>
                      <Badge>{format.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {format.description || "No description"}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Format</dt>
                        <dd>{format.formatType}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Duration</dt>
                        <dd>
                          {format.targetDurationMinSeconds ?? "?"}–
                          {format.targetDurationMaxSeconds ?? "?"}s
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          Platform / ratio
                        </dt>
                        <dd>
                          {String(
                            record(format.productionDefaults).platform ??
                              "System default",
                          )}{" "}
                          ·{" "}
                          {String(
                            record(format.productionDefaults).ratio ??
                              "System default",
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Example</dt>
                        <dd>{format.exampleOutput || "Not provided"}</dd>
                      </div>
                    </dl>
                    {Array.isArray(format.productionRules) &&
                      format.productionRules.length > 0 && (
                        <p className="mt-3 text-xs">
                          Rules: {format.productionRules.join(" · ")}
                        </p>
                      )}
                  </button>
                ))}
              </div>
            )}
            {errors.contentFormatId && (
              <p role="alert" className="text-sm text-destructive">
                {errors.contentFormatId}
              </p>
            )}
          </section>
        )}
        {state.step === 2 && (
          <section className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Describe the video</h2>
              <p className="text-sm text-muted-foreground">
                The Content Format defines production; the optional template
                defines narrative structure.
              </p>
            </div>
            <div>
              <Label htmlFor="title">Project title</Label>
              <Input
                id="title"
                value={state.title}
                onChange={(e) =>
                  setState((old) => ({
                    ...old,
                    title: e.target.value,
                    durableRunId: undefined,
                  }))
                }
                aria-invalid={Boolean(errors.title)}
              />
              {errors.title && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.title}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="idea">Concrete video idea</Label>
              <Textarea
                id="idea"
                className="min-h-32"
                value={state.idea}
                onChange={(e) =>
                  setState((old) => ({
                    ...old,
                    idea: e.target.value,
                    durableRunId: undefined,
                  }))
                }
                placeholder="A school bus tries to cross a collapsing suspension bridge while smaller cars attempt to escape."
                aria-invalid={Boolean(errors.idea)}
              />
              {errors.idea && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.idea}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="storyTemplateId">Story Template — optional</Label>
              <select
                id="storyTemplateId"
                className="h-10 w-full rounded-md border bg-background px-3"
                value={state.storyTemplateId}
                onChange={(e) =>
                  setState((old) => ({
                    ...old,
                    storyTemplateId: e.target.value,
                    durableRunId: undefined,
                  }))
                }
              >
                <option value="">No Story Template</option>
                {(templatesQuery.data ?? []).map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} · {template.targetDurationSeconds}s
                  </option>
                ))}
              </select>
              {selectedTemplate && (
                <Card className="mt-3 p-3 text-sm">
                  <strong>{selectedTemplate.name}</strong>
                  <p>{selectedTemplate.description || "No description"}</p>
                  {templateQuery.data && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {templateQuery.data.beats
                        .map(
                          (beat) => `${beat.phase} (${beat.durationSeconds}s)`,
                        )
                        .join(" → ")}
                    </p>
                  )}
                </Card>
              )}
            </div>
            <div>
              <h3 className="mb-3 font-semibold">Format-specific inputs</h3>
              {!inputSchema.success ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive p-3 text-sm text-destructive"
                >
                  This format contains an unsupported field type. Generation is
                  blocked until the schema is updated.
                </p>
              ) : Object.keys(inputSchema.data.properties).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This format has no additional inputs.
                </p>
              ) : (
                <FormatInputsRenderer
                  schema={inputSchema.data}
                  values={state.formatInputs}
                  errors={Object.fromEntries(
                    Object.entries(errors)
                      .filter(([key]) => key.startsWith("formatInputs."))
                      .map(([key, value]) => [key.slice(13), value]),
                  )}
                  onChange={(formatInputs) =>
                    setState((old) => ({
                      ...old,
                      formatInputs,
                      durableRunId: undefined,
                    }))
                  }
                />
              )}
            </div>
          </section>
        )}
        {state.step === 3 && (
          <section className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Production Settings</h2>
              <p className="text-sm text-muted-foreground">
                These resolved values are frozen into the new Run.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="production-ratio">Aspect ratio</Label>
                <select
                  id="production-ratio"
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={state.production.ratio}
                  onChange={(e) =>
                    setState((old) => ({
                      ...old,
                      production: {
                        ...old.production,
                        ratio: e.target
                          .value as LocalState["production"]["ratio"],
                      },
                      durableRunId: undefined,
                    }))
                  }
                >
                  {["16:9", "9:16", "4:3", "3:4", "1:1"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="production-targetDurationSeconds">
                  Target duration (seconds)
                </Label>
                <Input
                  id="production-targetDurationSeconds"
                  type="number"
                  min={1}
                  value={state.production.targetDurationSeconds}
                  onChange={(e) =>
                    setState((old) => ({
                      ...old,
                      production: {
                        ...old.production,
                        targetDurationSeconds: Number(e.target.value),
                      },
                      durableRunId: undefined,
                    }))
                  }
                  aria-invalid={duration ? !duration.valid : false}
                />
                {duration && !duration.valid && (
                  <p role="alert" className="text-sm text-destructive">
                    {duration.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Effective duration: {state.production.targetDurationSeconds}s
                </p>
              </div>
              <div>
                <Label htmlFor="production-language">Language</Label>
                <select
                  id="production-language"
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={state.production.language}
                  onChange={(e) =>
                    setState((old) => ({
                      ...old,
                      production: {
                        ...old.production,
                        language: e.target.value,
                      },
                      durableRunId: undefined,
                    }))
                  }
                >
                  {[
                    ["none", "No spoken language"],
                    ["en", "English"],
                    ["ru", "Russian"],
                    ["he", "Hebrew"],
                    ["es", "Spanish"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="production-platform">Platform</Label>
                <select
                  id="production-platform"
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={state.production.platform}
                  onChange={(e) =>
                    setState((old) => ({
                      ...old,
                      production: {
                        ...old.production,
                        platform: e.target
                          .value as LocalState["production"]["platform"],
                      },
                      durableRunId: undefined,
                    }))
                  }
                >
                  {[
                    "youtube",
                    "youtube_shorts",
                    "tiktok",
                    "instagram_reels",
                    "other",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="production-audioMode">Audio mode</Label>
                <select
                  id="production-audioMode"
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={state.production.audioMode}
                  onChange={(e) =>
                    setState((old) => ({
                      ...old,
                      production: {
                        ...old.production,
                        audioMode: e.target
                          .value as LocalState["production"]["audioMode"],
                      },
                      durableRunId: undefined,
                    }))
                  }
                >
                  {["none", "music", "voiceover", "music_and_voiceover"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </div>
            </div>
            <ModelSelector
              type="text-to-text"
              label="Scenario text model"
              value={state.modelIds.text || null}
              onChange={(text) =>
                setState((old) => ({
                  ...old,
                  modelIds: { ...old.modelIds, text: text ?? "" },
                  durableRunId: undefined,
                }))
              }
              filter={(model) => scenarioTextModels([model]).length === 1}
              emptyMessage="No enabled model supports durable scenario generation."
            />
            <ModelSelector
              type="text-to-image"
              label="Image model (saved only)"
              value={state.modelIds.image || null}
              onChange={(image) =>
                setState((old) => ({
                  ...old,
                  modelIds: { ...old.modelIds, image: image ?? "" },
                  durableRunId: undefined,
                }))
              }
            />
            <ModelSelector
              type="image-to-video"
              label="Video model (saved only)"
              value={state.modelIds.video || null}
              onChange={(video) =>
                setState((old) => ({
                  ...old,
                  modelIds: { ...old.modelIds, video: video ?? "" },
                  durableRunId: undefined,
                }))
              }
            />
            {errors["production.targetDurationSeconds"] && (
              <p role="alert" className="text-sm text-destructive">
                {errors["production.targetDurationSeconds"]}
              </p>
            )}
          </section>
        )}
        {state.step === 4 && (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold">Review & Generate</h2>
              <p className="text-sm text-muted-foreground">
                A Project, immutable Run, and durable Scenario Attempt will be
                created.
              </p>
            </div>
            <Card className="space-y-3 p-4 text-sm">
              <Summary label="Project" value={state.title} />
              <Summary label="Idea" value={state.idea} />
              <Summary label="Content Format" value={selectedFormat?.name} />
              <Summary
                label="Story Template"
                value={selectedTemplate?.name ?? "None"}
              />
              <Summary
                label="Format inputs"
                value={JSON.stringify(state.formatInputs)}
              />
              <Summary
                label="Production"
                value={`${state.production.ratio} · ${state.production.targetDurationSeconds}s · ${state.production.language} · ${state.production.platform} · ${state.production.audioMode}`}
              />
              <Summary
                label="Models"
                value={`${state.modelIds.text} · ${state.modelIds.image} · ${state.modelIds.video}`}
              />
            </Card>
            {stage && (
              <p
                role="status"
                aria-live="polite"
                className="flex items-center gap-2"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                {stage}
              </p>
            )}
            {submitError && (
              <div
                role="alert"
                className="rounded-md border border-destructive p-4 text-sm text-destructive"
              >
                <p>{submitError}</p>
                {state.durableProjectId && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={submit}>
                      {state.durableRunId ? "Generate scenario" : "Create Run"}
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href={`/hwar/projects/${state.durableProjectId}`}>
                        Open Project
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </Card>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          variant="outline"
          onClick={() =>
            state.step === 1
              ? router.push("/hwar/create")
              : setState((old) => ({ ...old, step: old.step - 1 }))
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {state.step === 1 ? "Cancel" : "Back"}
        </Button>
        {state.step < 4 ? (
          <Button onClick={next}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={submitting || !validation?.success}
            title={
              !validation?.success
                ? "Complete all required fields before generating"
                : undefined
            }
          >
            {submitting
              ? "Working…"
              : sourceRunId
                ? "Change settings and create new run"
                : "Create Project & Generate Scenario"}
            <Check className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="font-medium">{label}</dt>
      <dd className="break-words text-muted-foreground">
        {value || "Not selected"}
      </dd>
    </div>
  );
}
function Loading({ text }: { text: string }) {
  return (
    <p role="status" className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </p>
  );
}
function ErrorState({ text, retry }: { text: string; retry: () => void }) {
  return (
    <div role="alert">
      <p>{text}</p>
      <Button className="mt-2" variant="outline" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}
