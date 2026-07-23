import {
  resolveContentFormatProductionRules,
  type ContentFormatProductionRulesV1,
} from "./creation-wizard";
import type { Scenario } from "./scenario-generation";

export const scenarioFormatIssueCodes = [
  "SCENE_COUNT_MISMATCH",
  "SCENE_DURATION_MISMATCH",
  "TOTAL_DURATION_MISMATCH",
  "CAMERA_MOVEMENT_FORBIDDEN",
  "CAMERA_ANGLE_OUT_OF_RANGE",
  "CAMERA_FRAMING_CHANGED",
  "CAMERA_CUT_FORBIDDEN",
  "SLOW_MOTION_FORBIDDEN",
  "CONTINUITY_NOT_PRESERVED",
  "PREVIOUS_FRAME_REFERENCE_MISSING",
  "VEHICLE_DIRECTION_MISMATCH",
  "OBSTACLE_POSITION_MISMATCH",
  "FIRE_EXPLOSION_FORBIDDEN",
  "HUMAN_OR_GORE_FORBIDDEN",
  "HUD_OR_OVERLAY_FORBIDDEN",
  "REQUIRED_CONCEPT_MISSING",
  "STRUCTURED_COMPLIANCE_MISSING",
  "STRUCTURED_COMPLIANCE_CONTRADICTION",
] as const;
export type ScenarioFormatIssueCode = (typeof scenarioFormatIssueCodes)[number];
export type ScenarioFormatIssue = {
  code: ScenarioFormatIssueCode;
  candidateIndex: number;
  sceneIndex?: number;
};
const add = (
  out: ScenarioFormatIssue[],
  code: ScenarioFormatIssueCode,
  candidateIndex: number,
) => {
  if (!out.some((i) => i.code === code && i.candidateIndex === candidateIndex))
    out.push({ code, candidateIndex });
};
const text = (s: Scenario) =>
  [
    s.title,
    s.description,
    ...s.scenes.flatMap((x) => [x.description, ...(x.cameraCommands ?? [])]),
  ]
    .join("\n")
    .toLowerCase();
const move =
  /\b(pull(?:s)? back|push(?:es)? in|zoom(?:s|ed)?(?: in| out)?|pan(?:s|ned)?|tilt(?:s|ed)?|camera moves?|camera shifts?|frame tightens?|framing widens?|wide (?:final )?shot|new angle)\b/;
export function validateScenarioFormatAdherence(
  scenarios: Scenario[],
  rulesInput: unknown,
): ScenarioFormatIssue[] {
  const rules: ContentFormatProductionRulesV1 =
    resolveContentFormatProductionRules(rulesInput);
  const required = rulesInput != null && !Array.isArray(rulesInput);
  const out: ScenarioFormatIssue[] = [];
  scenarios.forEach((scenario, candidateIndex) => {
    const plan = scenario.productionPlan,
      prose = text(scenario),
      t = rules.timing,
      c = rules.camera,
      n = rules.continuity,
      f = rules.forbidden;
    if (required && !plan)
      add(out, "STRUCTURED_COMPLIANCE_MISSING", candidateIndex);
    const durations =
      plan?.sceneDurations ?? scenario.scenes.map((s) => s.duration);
    if (
      t.exactSceneCount &&
      (plan?.sceneCount ?? scenario.scenes.length) !== t.exactSceneCount
    )
      add(out, "SCENE_COUNT_MISMATCH", candidateIndex);
    if (
      t.sceneDurationSeconds &&
      durations.some((d) => Math.abs(d - t.sceneDurationSeconds!) > 0.001)
    )
      add(out, "SCENE_DURATION_MISMATCH", candidateIndex);
    if (
      t.totalDurationSeconds &&
      Math.abs(durations.reduce((a, b) => a + b, 0) - t.totalDurationSeconds) >
        0.001
    )
      add(out, "TOTAL_DURATION_MISMATCH", candidateIndex);
    if (
      c.movement === "static" &&
      (plan?.cameraMovement === "dynamic" || move.test(prose))
    )
      add(out, "CAMERA_MOVEMENT_FORBIDDEN", candidateIndex);
    if (c.framingLocked && (plan?.framingChanges || move.test(prose)))
      add(out, "CAMERA_FRAMING_CHANGED", candidateIndex);
    if (c.noCuts && (plan?.cuts || /\bcut to\b|\bnew angle\b/.test(prose)))
      add(out, "CAMERA_CUT_FORBIDDEN", candidateIndex);
    if (
      c.angleDegrees &&
      (!plan?.cameraAngleDegrees ||
        plan.cameraAngleDegrees < c.angleDegrees.min ||
        plan.cameraAngleDegrees > c.angleDegrees.max ||
        /\b(?:35|40|45|50)\s*(?:°|degrees?)\b/.test(prose))
    )
      add(out, "CAMERA_ANGLE_OUT_OF_RANGE", candidateIndex);
    if (
      f.slowMotion &&
      (plan?.slowMotion || /\bslow(?:-| )?mo(?:tion)?\b/.test(prose))
    )
      add(out, "SLOW_MOTION_FORBIDDEN", candidateIndex);
    if (
      f.fireExplosions &&
      /\b(fire|flames?|fireball|combustion)\b/.test(prose)
    )
      add(out, "FIRE_EXPLOSION_FORBIDDEN", candidateIndex);
    if (
      (f.humans || f.gore) &&
      /\b(humans?|people|person|blood|gore|corpse)\b/.test(prose)
    )
      add(out, "HUMAN_OR_GORE_FORBIDDEN", candidateIndex);
    if (
      (f.hud || f.watermarks || f.textOverlays) &&
      /\b(hud|watermark|text overlay|on-screen text|caption)\b/.test(prose)
    )
      add(out, "HUD_OR_OVERLAY_FORBIDDEN", candidateIndex);
    if (
      n.usePreviousFinalFrame &&
      (!plan?.previousFrameContinuity ||
        !/previous (?:final )?frame|continu(?:e|es|ing) (?:directly )?from/.test(
          prose,
        ))
    )
      add(out, "PREVIOUS_FRAME_REFERENCE_MISSING", candidateIndex);
    if (
      n.persistentWreckage &&
      (!plan?.persistentWreckage ||
        !/persistent wreckage|wreckage remains|debris remains/.test(prose))
    )
      add(out, "CONTINUITY_NOT_PRESERVED", candidateIndex);
    if (
      n.vehicleEntryDirection &&
      plan?.vehicleEntryDirection?.toLowerCase() !==
        n.vehicleEntryDirection.toLowerCase()
    )
      add(out, "VEHICLE_DIRECTION_MISMATCH", candidateIndex);
    if (
      n.obstaclePosition &&
      plan?.obstaclePosition?.toLowerCase() !== n.obstaclePosition.toLowerCase()
    )
      add(out, "OBSTACLE_POSITION_MISMATCH", candidateIndex);
    for (const concept of rules.requiredConcepts ?? [])
      if (!prose.includes(concept.toLowerCase()))
        add(out, "REQUIRED_CONCEPT_MISSING", candidateIndex);
  });
  return out;
}
