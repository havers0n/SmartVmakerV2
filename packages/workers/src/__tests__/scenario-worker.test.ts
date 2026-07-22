import { describe, expect, it } from "vitest";
import {
  compileScenarioPrompt,
  resolveScenarioProviderModelId,
} from "../scenario-worker";

describe("scenario prompt compiler", () => {
  it("compiles only immutable run snapshots", () => {
    const compiled = compileScenarioPrompt({
      inputSnapshot: {
        production: { ratio: "1:1", language: "he", targetDurationSeconds: 24 },
        formatInputs: { environment: "suspension bridge", vehicleCount: 8 },
      },
      projectSnapshot: { title: "Crusher test", idea: "Escalate vehicle size" },
      contentFormatSnapshot: { hookPattern: "Outcome first" },
      storyTemplateSnapshot: null,
      sourceSnapshot: {
        references: [{ kind: "external", uri: "https://example.com" }],
      },
    });
    expect(compiled.prompt).toContain("1:1");
    expect(compiled.prompt).toContain("24 seconds");
    expect(compiled.prompt).toContain("Escalate vehicle size");
    expect(compiled.prompt).toContain("Outcome first");
    expect(compiled.prompt).toContain("suspension bridge");
  });

  it("maps the immutable catalog id to the MiniMax provider model id", () => {
    expect(resolveScenarioProviderModelId("minimax", "minimax-m2")).toBe(
      "MiniMax-M2",
    );
  });
});
