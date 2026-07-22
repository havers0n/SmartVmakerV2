import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/db", () => ({ db: {} }));
import {
  assertGenerationRunTransition,
  createGenerationRunSchema,
  projectDefaultsSchema,
  resolveGenerationRunSnapshot,
  updateVideoProjectSchema,
} from "./generation-runs";

const project = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Small Cars vs Rotating Crusher",
  idea: "Test how progressively larger toy cars survive a rotating crusher.",
  status: "active" as const,
  contentFormatId: "550e8400-e29b-41d4-a716-446655440001",
  storyTemplateId: null,
  projectDefaults: {
    schemaVersion: 1 as const,
    production: { language: "en", targetDurationSeconds: 40 },
    models: { text: { provider: "minimax", modelId: "project-text" } },
  },
};

const format = {
  id: project.contentFormatId,
  name: "Escalating physical test",
  slug: "escalating-physical-test",
  description: null,
  status: "active",
  formatType: "short_form",
  hookPattern: "Show the outcome first",
  structurePattern: null,
  visualPattern: null,
  pacingPattern: null,
  targetDurationMinSeconds: 20,
  targetDurationMaxSeconds: 30,
};

describe("generation run foundation contracts", () => {
  it("normalizes typed project defaults and rejects unknown fields", () => {
    expect(projectDefaultsSchema.parse({})).toEqual({
      schemaVersion: 1,
      production: {},
      models: {},
    });
    expect(
      projectDefaultsSchema.safeParse({
        production: { ratio: "9:16", arbitrary: true },
      }).success,
    ).toBe(false);
    expect(
      updateVideoProjectSchema.safeParse({ defaults: { anything: "goes" } })
        .success,
    ).toBe(false);
  });

  it("resolves overrides before project, format and system defaults", () => {
    const snapshot = resolveGenerationRunSnapshot({
      project,
      contentFormat: format,
      storyTemplate: null,
      overrides: {
        production: { language: "he", ratio: "1:1" },
        models: { text: { provider: "openai", modelId: "run-text" } },
      },
    });
    expect(snapshot.inputSnapshot.production).toEqual({
      ratio: "1:1",
      language: "he",
      targetDurationSeconds: 40,
      platform: "youtube_shorts",
      audioMode: "none",
    });
    expect(snapshot.modelSnapshot.text).toEqual({
      provider: "openai",
      modelId: "run-text",
    });
    expect(snapshot.modelSnapshot.image.modelId).toBe("gemini-2.5-flash-image");
  });

  it("uses the midpoint of a format duration range before the system default", () => {
    const snapshot = resolveGenerationRunSnapshot({
      project: { ...project, projectDefaults: {} },
      contentFormat: format,
      storyTemplate: null,
    });
    expect(snapshot.inputSnapshot.production.targetDurationSeconds).toBe(25);
  });

  it("keeps project duration above format and template defaults", () => {
    const snapshot = resolveGenerationRunSnapshot({
      project: {
        ...project,
        projectDefaults: {
          production: { targetDurationSeconds: 30 },
          models: {},
        },
      },
      contentFormat: format,
      storyTemplate: {
        id: "550e8400-e29b-41d4-a716-446655440099",
        name: "Sixty second story",
        description: null,
        tags: null,
        targetDurationSeconds: 60,
        beats: [],
      },
    });
    expect(snapshot.inputSnapshot.production.targetDurationSeconds).toBe(30);
  });

  it("returns deeply frozen snapshot values", () => {
    const snapshot = resolveGenerationRunSnapshot({
      project,
      contentFormat: format,
      storyTemplate: null,
    });
    project.projectDefaults.production.language = "mutated-after-run";
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.inputSnapshot.production)).toBe(true);
    expect(snapshot.inputSnapshot.production.language).toBe("en");
    expect(() => {
      (snapshot.inputSnapshot.production as { language: string }).language =
        "changed";
    }).toThrow();
  });

  it("creates only draft runs and rejects injected status or snapshot fields", () => {
    expect(createGenerationRunSchema.parse({})).toEqual({});
    expect(
      createGenerationRunSchema.safeParse({ status: "queued" }).success,
    ).toBe(false);
    expect(
      createGenerationRunSchema.safeParse({
        inputSnapshot: { arbitrary: true },
      }).success,
    ).toBe(false);
  });

  it("defines forward-only operational state transitions", () => {
    expect(() =>
      assertGenerationRunTransition("draft", "queued"),
    ).not.toThrow();
    expect(() =>
      assertGenerationRunTransition("draft", "active"),
    ).not.toThrow();
    expect(() =>
      assertGenerationRunTransition("queued", "running"),
    ).not.toThrow();
    expect(() =>
      assertGenerationRunTransition("running", "succeeded"),
    ).not.toThrow();
    expect(() => assertGenerationRunTransition("succeeded", "running")).toThrow(
      /Cannot transition/,
    );
    expect(() => assertGenerationRunTransition("draft", "succeeded")).toThrow(
      /Cannot transition/,
    );
  });
});
