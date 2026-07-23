import { describe, expect, it } from "vitest";
import {
  contentFormatProductionRulesSchema,
  contentFormatProductionRulesV1Schema,
  resolveContentFormatProductionRules,
} from "./creation-wizard";
import { scenarioSchema } from "./scenario-generation";
import { validateScenarioFormatAdherence } from "./scenario-format-adherence";

const rules = {
  version: 1 as const,
  instructions: ["fixed camera"],
  timing: {
    exactSceneCount: 4,
    sceneDurationSeconds: 8,
    totalDurationSeconds: 32,
  },
  camera: {
    movement: "static" as const,
    angleDegrees: { min: 20, max: 25 },
    framingLocked: true,
    noZoom: true,
    noPan: true,
    noTilt: true,
    noShake: true,
    noCuts: true,
  },
  continuity: {
    usePreviousFinalFrame: true,
    persistentWreckage: true,
    vehicleEntryDirection: "top",
    obstaclePosition: "lower-middle",
  },
  forbidden: {
    slowMotion: true,
    fireExplosions: true,
    humans: true,
    gore: true,
    hud: true,
    watermarks: true,
    textOverlays: true,
  },
};
const candidate = (
  prose = "Static camera. Previous final frame continues directly; wreckage remains.",
  patch: Record<string, unknown> = {},
) => ({
  title: "Crash",
  description: prose,
  aesScore: 80,
  hookStrength: 80,
  emotionalCurve: ["tense"],
  scenes: Array.from({ length: 4 }, () => ({
    phase: "BUILD",
    duration: 8,
    description: prose,
  })),
  productionPlan: {
    sceneCount: 4,
    sceneDurations: [8, 8, 8, 8],
    cameraMovement: "static" as const,
    cameraAngleDegrees: 22,
    framingChanges: false,
    cuts: false,
    slowMotion: false,
    previousFrameContinuity: true,
    persistentWreckage: true,
    vehicleEntryDirection: "top",
    obstaclePosition: "lower-middle",
    ...patch,
  },
});
const codes = (value: ReturnType<typeof candidate>[]) =>
  validateScenarioFormatAdherence(value, rules).map((x) => x.code);
describe("ContentFormatProductionRulesV1", () => {
  it("accepts minimal, BeamNG, and legacy contracts", () => {
    expect(
      contentFormatProductionRulesV1Schema.parse({ version: 1 }),
    ).toMatchObject({ version: 1 });
    expect(
      contentFormatProductionRulesV1Schema.parse(rules).camera.angleDegrees,
    ).toEqual({ min: 20, max: 25 });
    expect(resolveContentFormatProductionRules(["legacy"])).toMatchObject({
      version: 1,
      instructions: ["legacy"],
    });
  });
  it.each([
    { version: 2 },
    { version: 1, camera: { unknown: true } },
    { version: 1, timing: { sceneDurationSeconds: 0 } },
    { version: 1, timing: { totalDurationSeconds: -1 } },
    { version: 1, camera: { angleDegrees: { min: 25, max: 20 } } },
    {
      version: 1,
      timing: {
        exactSceneCount: 4,
        sceneDurationSeconds: 8,
        totalDurationSeconds: 31,
      },
    },
    { version: 1, camera: { movement: "dynamic", framingLocked: true } },
    { version: 1, instructions: ["x".repeat(1001)] },
    { version: 1, instructions: Array.from({ length: 101 }, () => "x") },
  ])("rejects invalid contract %#", (input) =>
    expect(contentFormatProductionRulesV1Schema.safeParse(input).success).toBe(
      false,
    ),
  );
  it("does not treat malformed legacy data as v1", () =>
    expect(
      contentFormatProductionRulesSchema.safeParse({ version: 99 }).success,
    ).toBe(false));
  it("keeps historical candidates parseable without productionPlan", () =>
    expect(
      scenarioSchema.safeParse({ ...candidate(), productionPlan: undefined })
        .success,
    ).toBe(true));
});
describe("BeamNG format adherence", () => {
  it("accepts the compliant fixture", () =>
    expect(codes([candidate()])).toEqual([]));
  it("requires a production plan for a contracted run", () =>
    expect(
      codes([{ ...candidate(), productionPlan: undefined } as any]),
    ).toContain("STRUCTURED_COMPLIANCE_MISSING"));
  it.each([
    ["positioned 35 degrees above road", {}, "CAMERA_ANGLE_OUT_OF_RANGE"],
    ["positioned 45 degrees above road", {}, "CAMERA_ANGLE_OUT_OF_RANGE"],
    ["pull back slightly", {}, "CAMERA_FRAMING_CHANGED"],
    ["frame tightens slightly", {}, "CAMERA_FRAMING_CHANGED"],
    ["end on wide shot", {}, "CAMERA_FRAMING_CHANGED"],
    ["zoom in", {}, "CAMERA_MOVEMENT_FORBIDDEN"],
    ["pan left", {}, "CAMERA_MOVEMENT_FORBIDDEN"],
    ["camera shifts", {}, "CAMERA_MOVEMENT_FORBIDDEN"],
    ["cut to crash", {}, "CAMERA_CUT_FORBIDDEN"],
    ["slow motion", {}, "SLOW_MOTION_FORBIDDEN"],
    ["slow-mo", {}, "SLOW_MOTION_FORBIDDEN"],
    [
      "static camera then frame tightens slightly",
      {},
      "CAMERA_FRAMING_CHANGED",
    ],
    ["visible flames and fireball", {}, "FIRE_EXPLOSION_FORBIDDEN"],
    ["humans and gore", {}, "HUMAN_OR_GORE_FORBIDDEN"],
    ["HUD text overlay", {}, "HUD_OR_OVERLAY_FORBIDDEN"],
    [
      "Static camera. Previous final frame continues directly; wreckage remains.",
      { sceneCount: 3 },
      "SCENE_COUNT_MISMATCH",
    ],
    [
      "Static camera. Previous final frame continues directly; wreckage remains.",
      { sceneDurations: [8, 8, 8, 7] },
      "SCENE_DURATION_MISMATCH",
    ],
    [
      "Static camera. Previous final frame continues directly; wreckage remains.",
      { sceneDurations: [8, 8, 8, 7] },
      "TOTAL_DURATION_MISMATCH",
    ],
    [
      "Static camera. wreckage remains.",
      { previousFrameContinuity: false },
      "PREVIOUS_FRAME_REFERENCE_MISSING",
    ],
    [
      "Static camera. Previous final frame continues directly.",
      { persistentWreckage: false },
      "CONTINUITY_NOT_PRESERVED",
    ],
    [
      "Static camera. Previous final frame continues directly; wreckage remains.",
      { vehicleEntryDirection: "bottom" },
      "VEHICLE_DIRECTION_MISMATCH",
    ],
    [
      "Static camera. Previous final frame continues directly; wreckage remains.",
      { obstaclePosition: "upper" },
      "OBSTACLE_POSITION_MISMATCH",
    ],
  ] as const)("reports %s", (prose, patch, code) =>
    expect(codes([candidate(prose, patch)])).toContain(code),
  );
  it("does not misclassify debris, sparks, or smoke as fire", () =>
    expect(
      codes([
        candidate(
          "Static camera. Previous final frame continues directly; wreckage remains after an explosion of debris, sparks, dust and light smoke.",
        ),
      ]),
    ).not.toContain("FIRE_EXPLOSION_FORBIDDEN"));
  it("validates candidates independently", () => {
    const issues = validateScenarioFormatAdherence(
      [candidate(), candidate("pull back slightly")],
      rules,
    );
    expect(issues.some((i) => i.candidateIndex === 0)).toBe(false);
    expect(issues.some((i) => i.candidateIndex === 1)).toBe(true);
  });
});
