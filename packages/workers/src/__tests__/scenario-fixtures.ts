import type { Scenario } from "@scrimspec/shared-types";

export const beamNgContract = {
  version: 1 as const,
  instructions: ["BeamNG collision sequence with frozen production rules."],
  timing: {
    exactSceneCount: 4,
    sceneDurationSeconds: 8,
    totalDurationSeconds: 32,
  },
  camera: {
    movement: "static" as const,
    angleDegrees: { min: 20, max: 25 },
    framingLocked: true,
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

const scenes = (description: string) =>
  ["HOOK", "BUILD", "PAYOFF", "RESOLUTION"].map((phase) => ({
    phase,
    duration: 8,
    description,
    cameraCommands: ["Static camera at 22 degrees."],
  }));

export function compliantScenario(): Scenario {
  return {
    title: "Top-entry obstacle collision",
    description:
      "Static 22 degree camera with locked framing. Vehicles enter from the top into the lower-middle obstacle. Each scene continues directly from the previous final frame and wreckage remains.",
    aesScore: 88,
    hookStrength: 92,
    emotionalCurve: ["tension", "impact", "release"],
    scenes: scenes(
      "Static 22 degree view; vehicles enter from the top, the obstacle remains lower-middle, previous final frame continues directly, and wreckage remains.",
    ),
    productionPlan: {
      sceneCount: 4,
      sceneDurations: [8, 8, 8, 8],
      cameraMovement: "static",
      cameraAngleDegrees: 22,
      framingChanges: false,
      cuts: false,
      slowMotion: false,
      previousFrameContinuity: true,
      persistentWreckage: true,
      vehicleEntryDirection: "top",
      obstaclePosition: "lower-middle",
    },
  };
}

export function invalidScenario(): Scenario {
  const scenario = compliantScenario();
  return {
    ...scenario,
    description:
      "Camera at 45 degrees, pull back slightly, then use slow motion while vehicles hit the obstacle.",
    scenes: scenes(
      "45 degrees above the road; pull back slightly into slow motion for impact.",
    ),
    productionPlan: {
      ...scenario.productionPlan!,
      cameraAngleDegrees: 45,
      framingChanges: true,
      slowMotion: true,
    },
  };
}

export function missingPlanScenario(): Scenario {
  const { productionPlan: _productionPlan, ...scenario } = compliantScenario();
  return scenario;
}

export const fakeSuccess = (scenarios: Scenario[]) => ({
  scenarios,
  providerRequestId: "fake-provider-request",
  finishReason: "stop",
  usage: { total_tokens: 123 },
  diagnostic: {
    rawProviderBody: "SENTINEL_PROVIDER_RAW_BODY",
    apiKey: "SENTINEL_API_KEY",
    authorization: "SENTINEL_AUTHORIZATION",
  },
});
