import { describe, expect, it } from "vitest";
import {
  buildProjectRequest,
  buildRunRequest,
  defaultsForInputSchema,
  newIdempotencyKey,
  parseFormatInputSchema,
  resolveDuration,
  scenarioArtifactResponseSchema,
  scenarioPollInterval,
  scenarioTextModels,
  userMessageForError,
  validateWizard,
} from "./model";

const format = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Crash simulation",
  slug: "crash-simulation",
  status: "active" as const,
  formatType: "short_form",
  targetDurationMinSeconds: 20,
  targetDurationMaxSeconds: 40,
  inputSchema: {
    type: "object",
    properties: {
      environment: { type: "string", description: "Where it happens" },
      count: { type: "integer", minimum: 1, maximum: 20, default: 8 },
      intensity: { type: "string", enum: ["low", "high"] },
      notes: { type: "string", format: "multiline" },
      enabled: { type: "boolean", default: true },
    },
    required: ["environment", "count", "intensity"],
    additionalProperties: false,
  },
  updatedAt: "2026-07-22T00:00:00.000Z",
};

const value = {
  contentFormatId: format.id,
  title: "Bridge collapse",
  idea: "A school bus crosses a collapsing suspension bridge.",
  storyTemplateId: null,
  formatInputs: {
    environment: "bridge",
    count: 8,
    intensity: "high",
    enabled: true,
  },
  production: {
    ratio: "9:16" as const,
    targetDurationSeconds: 30,
    language: "en",
    platform: "youtube_shorts" as const,
    audioMode: "none" as const,
  },
  models: {
    text: { provider: "minimax", modelId: "minimax-m2" },
    image: { provider: "google_gemini", modelId: "image" },
    video: { provider: "minimax", modelId: "video" },
  },
};

describe("Creation Wizard V2 contracts", () => {
  it("maps typed format fields and defaults", () => {
    const schema = parseFormatInputSchema(format.inputSchema);
    expect(schema.success).toBe(true);
    if (schema.success)
      expect(defaultsForInputSchema(schema.data)).toEqual({
        count: 8,
        enabled: true,
      });
  });

  it("rejects missing required format inputs", () => {
    const result = validateWizard(
      { ...value, formatInputs: { count: 8, intensity: "high" } },
      format,
    );
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].path).toEqual([
        "formatInputs",
        "environment",
      ]);
  });

  it("blocks unsupported schema field types", () => {
    expect(
      parseFormatInputSchema({
        type: "object",
        properties: { tags: { type: "array" } },
        required: [],
      }).success,
    ).toBe(false);
  });

  it("reports format and Story Template duration conflicts without clamping", () => {
    expect(resolveDuration({ requested: 10, format }).valid).toBe(false);
    const template = resolveDuration({
      requested: 30,
      format,
      templateDuration: 35,
    });
    expect(template.valid).toBe(false);
    if (!template.valid) expect(template.message).toContain("35 seconds");
  });

  it("filters registry models to the worker-supported scenario capability", () => {
    const common = {
      name: "Model",
      type: "text-to-text" as const,
      isDefault: false,
      isEnabled: true,
      costDetails: null,
      metadata: null,
    };
    const models = scenarioTextModels([
      {
        ...common,
        id: "ok",
        providerId: "minimax",
        providerName: "MiniMax",
        capabilities: ["function_calling"],
      },
      {
        ...common,
        id: "wrong-provider",
        providerId: "google",
        providerName: "Google",
        capabilities: ["function_calling"],
      },
      {
        ...common,
        id: "wrong-capability",
        providerId: "minimax",
        providerName: "MiniMax",
        capabilities: ["streaming"],
      },
    ]);
    expect(models.map((model) => model.id)).toEqual(["ok"]);
  });

  it("builds Project and Run payloads with frozen input sources", () => {
    const project = buildProjectRequest(value, "submit:one");
    const run = buildRunRequest(value, "submit:one");
    expect(project.defaults.formatInputs).toEqual(value.formatInputs);
    expect(run).toEqual({
      clientSubmissionId: "submit:one",
      overrides: { production: value.production, models: value.models },
    });
  });

  it("keeps one key stable when retained and gives Retry a new key", () => {
    const submit = newIdempotencyKey("submit");
    const sameAction = submit;
    const retry = newIdempotencyKey("retry");
    expect(sameAction).toBe(submit);
    expect(retry).not.toBe(submit);
    expect(retry).toMatch(/^retry:/);
  });

  it("polls only active attempts and pauses in hidden or terminal states", () => {
    expect(scenarioPollInterval("queued", false)).toBe(2500);
    expect(scenarioPollInterval("running", false)).toBe(2500);
    expect(scenarioPollInterval("running", true)).toBe(false);
    expect(scenarioPollInterval("ready", false)).toBe(false);
    expect(scenarioPollInterval("failed", false)).toBe(false);
  });

  it("validates Scenario Artifact payloads at the client boundary", () => {
    const artifact = {
      id: crypto.randomUUID(),
      runId: crypto.randomUUID(),
      attemptId: crypto.randomUUID(),
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      scenarios: [
        {
          title: "Safe",
          description: "Validated",
          aesScore: 90,
          hookStrength: 85,
          emotionalCurve: ["tension"],
          scenes: [
            { phase: "HOOK", duration: 5, description: "Bridge starts moving" },
          ],
        },
      ],
    };
    expect(scenarioArtifactResponseSchema.safeParse(artifact).success).toBe(
      true,
    );
    expect(
      scenarioArtifactResponseSchema.safeParse({
        ...artifact,
        scenarios: [{ raw: "provider response" }],
      }).success,
    ).toBe(false);
  });

  it("maps typed failures without exposing diagnostics", () => {
    expect(
      userMessageForError({
        code: "SCENARIO_GENERATION_TRUNCATED",
        correlationId: "request-1",
      }),
    ).toContain("incomplete");
    expect(
      userMessageForError({
        code: "SCENARIO_GENERATION_TRUNCATED",
        correlationId: "request-1",
      }),
    ).toContain("request-1");
  });
});
