import { describe, expect, it } from "vitest";
import { validateScenarioFormatAdherence } from "@scrimspec/shared-types";
import {
  compileScenarioPrompt,
  resolveScenarioProviderModelId,
} from "../scenario-worker";
import {
  beamNgContract,
  compliantScenario,
  invalidScenario,
  missingPlanScenario,
} from "./scenario-fixtures";

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

describe("Content Format adherence", () => {
  it("rejects fixed-camera BeamNG contradictions independently", () => {
    const issues = validateScenarioFormatAdherence(
      [invalidScenario()],
      beamNgContract,
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "CAMERA_MOVEMENT_FORBIDDEN",
        "CAMERA_ANGLE_OUT_OF_RANGE",
        "CAMERA_FRAMING_CHANGED",
        "SLOW_MOTION_FORBIDDEN",
      ]),
    );
  });
  it("accepts compliant output and does not treat a debris burst as fire", () => {
    expect(
      validateScenarioFormatAdherence([compliantScenario()], beamNgContract),
    ).toEqual([]);
  });
  it("requires productionPlan only for contracted runs", () => {
    expect(
      validateScenarioFormatAdherence([missingPlanScenario()], beamNgContract),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "STRUCTURED_COMPLIANCE_MISSING" }),
      ]),
    );
    expect(
      validateScenarioFormatAdherence([missingPlanScenario()], null),
    ).toEqual([]);
  });
});
