import { z } from "zod";

const nonBlankString = (field: string, max: number) =>
  z.string().trim().min(1, `${field} must not be empty`).max(max);

export const sceneSchema = z
  .object({
    phase: nonBlankString("Scene phase", 100),
    duration: z.number().finite().positive().max(600),
    description: nonBlankString("Scene description", 5_000),
    cameraCommands: z
      .array(nonBlankString("Camera command", 500))
      .max(20)
      .optional(),
  })
  .strict();

export const scenarioSchema = z
  .object({
    title: nonBlankString("Scenario title", 500),
    description: nonBlankString("Scenario description", 5_000),
    aesScore: z.number().finite().min(0).max(100),
    hookStrength: z.number().finite().min(0).max(100),
    emotionalCurve: z.array(nonBlankString("Emotion", 100)).min(1).max(20),
    scenes: z.array(sceneSchema).min(1).max(100),
  })
  .strict();

export const scenariosSchema = z.array(scenarioSchema).min(1).max(10);
export type Scene = z.infer<typeof sceneSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;

export type ScenarioGenerationErrorCode =
  | "SCENARIO_GENERATION_INVALID_TYPE"
  | "SCENARIO_GENERATION_JSON_PARSE_FAILED"
  | "SCENARIO_GENERATION_SCHEMA_VALIDATION_FAILED"
  | "SCENARIO_GENERATION_EMPTY"
  | "SCENARIO_GENERATION_TRUNCATED";

const errorMessages: Record<ScenarioGenerationErrorCode, string> = {
  SCENARIO_GENERATION_INVALID_TYPE:
    "The model returned scenarios in an unsupported format.",
  SCENARIO_GENERATION_JSON_PARSE_FAILED:
    "The model returned malformed scenario data.",
  SCENARIO_GENERATION_SCHEMA_VALIDATION_FAILED:
    "The generated scenarios are missing required data.",
  SCENARIO_GENERATION_EMPTY: "The model did not generate any scenarios.",
  SCENARIO_GENERATION_TRUNCATED:
    "The model response was incomplete. Please retry scenario generation.",
};

export class ScenarioGenerationError extends Error {
  readonly status = 502;
  constructor(
    readonly code: ScenarioGenerationErrorCode,
    readonly details?: unknown,
    readonly issueCategories?: string[],
  ) {
    super(errorMessages[code]);
    this.name = "ScenarioGenerationError";
  }
}

export function isTruncationFinishReason(
  finishReason: string | null | undefined,
): boolean {
  if (!finishReason) return false;
  const normalized = finishReason.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    normalized === "length" ||
    normalized === "max_tokens" ||
    normalized === "token_limit"
  );
}

function looksLikeTruncatedJson(value: string, error: unknown): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[")) return false;
  if (!trimmed.endsWith("]")) return true;
  const message = error instanceof Error ? error.message : "";
  if (/unexpected end/i.test(message)) return true;
  const position = /position\s+(\d+)/i.exec(message)?.[1];
  return position !== undefined && Number(position) >= trimmed.length - 1;
}

export function normalizeAndValidateScenarios(
  rawValue: unknown,
  finishReason?: string | null,
): Scenario[] {
  if (isTruncationFinishReason(finishReason)) {
    throw new ScenarioGenerationError("SCENARIO_GENERATION_TRUNCATED", {
      finishReason,
    });
  }
  let value = rawValue;
  if (typeof value === "string") {
    const rawString = value;
    try {
      value = JSON.parse(rawString) as unknown;
    } catch (error) {
      throw new ScenarioGenerationError(
        looksLikeTruncatedJson(rawString, error)
          ? "SCENARIO_GENERATION_TRUNCATED"
          : "SCENARIO_GENERATION_JSON_PARSE_FAILED",
        {
          cause: error instanceof Error ? error.message : "JSON parsing failed",
          rawPayloadLength: rawString.length,
        },
      );
    }
  }
  if (!Array.isArray(value)) {
    throw new ScenarioGenerationError("SCENARIO_GENERATION_INVALID_TYPE", {
      receivedType: value === null ? "null" : typeof value,
    });
  }
  if (value.length === 0)
    throw new ScenarioGenerationError("SCENARIO_GENERATION_EMPTY");
  const result = scenariosSchema.safeParse(value);
  if (!result.success) {
    throw new ScenarioGenerationError(
      "SCENARIO_GENERATION_SCHEMA_VALIDATION_FAILED",
      {
        validationIssues: result.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path,
          message: issue.message,
        })),
      },
      [...new Set(result.error.issues.map((issue) => issue.code))],
    );
  }
  return result.data;
}

export function parseStoredScenarios(
  rawValue: unknown,
):
  | { success: true; scenarios: Scenario[] }
  | { success: false; code: ScenarioGenerationErrorCode } {
  try {
    return {
      success: true,
      scenarios: normalizeAndValidateScenarios(rawValue),
    };
  } catch (error) {
    return {
      success: false,
      code:
        error instanceof ScenarioGenerationError
          ? error.code
          : "SCENARIO_GENERATION_SCHEMA_VALIDATION_FAILED",
    };
  }
}

export function getScenarioWorkspaceState(
  rawValue: unknown,
  failureDiagnostic?: unknown,
):
  | { status: "ready"; scenarios: Scenario[] }
  | { status: "empty" }
  | { status: "corrupted" } {
  if (failureDiagnostic !== undefined) return { status: "corrupted" };
  if (rawValue === undefined) return { status: "empty" };
  const result = parseStoredScenarios(rawValue);
  return result.success
    ? { status: "ready", scenarios: result.scenarios }
    : { status: "corrupted" };
}
