import { ProjectPreview } from "@scrimspec/shared-types";

/**
 * API клиент для вызова Actions
 * Универсальная функция для взаимодействия с Action Runner
 */

export interface ActionResponse<T = unknown> {
  success: boolean;
  action: string;
  result?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

export interface ActionError {
  error: string;
  details?: unknown;
}

export class ActionHttpError extends Error {
  public readonly action: string;
  public readonly status: number;
  public readonly details?: unknown;
  public readonly code?: string;

  constructor(params: {
    action: string;
    status: number;
    message: string;
    code?: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "ActionHttpError";
    this.action = params.action;
    this.status = params.status;
    this.details = params.details;
    this.code = params.code;
  }
}

// Define types for story templates
export interface StoryTemplate {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  targetDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

// Define type for story template with beats
export interface StoryTemplateWithBeats extends StoryTemplate {
  beats: StoryBeat[];
}

// Define type for story beats
export interface StoryBeat {
  id: string;
  templateId: string;
  order: number;
  phase: "HOOK" | "BUILD" | "PAYOFF" | "RESOLUTION";
  durationSeconds: string; // Note: This is stored as string in the database
  description: string;
  actionPrompt?: string;
  emotion:
    | "joy"
    | "sadness"
    | "surprise"
    | "anticipation"
    | "tension"
    | "relief"
    | "empathy"
    | "curiosity"
    | "humor"
    | "awe";
  contrast?:
    | "small_vs_big"
    | "slow_vs_fast"
    | "alone_vs_together"
    | "sad_vs_happy"
    | "problem_vs_solution"
    | "before_vs_after";
  intendedImpact?: string;
  meta?: Record<string, unknown>;
}

// Define types for characters
export interface Character {
  id: string;
  name: string;
  description: string | null;
  stylePresets: Record<string, unknown> | null;
  referenceImageUrls: string[] | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Универсальная функция для вызова Actions через Action Runner
 *
 * @param action - Название действия (например, 'ingest.startSearch')
 * @param payload - Данные для обработчика
 * @returns Promise с результатом действия или ошибкой
 */
export async function callAction<T = unknown>(
  action: string,
  payload: unknown,
): Promise<T> {
  try {
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        payload,
      }),
    });

    const data: ActionResponse<T> = await response.json();

    if (!response.ok) {
      throw new ActionHttpError({
        action,
        status: response.status,
        message:
          data.error || `HTTP ${response.status}: ${response.statusText}`,
        code: data.code,
        details: data.details,
      });
    }

    if (!data.success) {
      throw new Error(data.error || "Action failed");
    }

    if (data.result === undefined) {
      throw new Error("No result returned from action");
    }

    return data.result;
  } catch (error) {
    // Перебрасываем ошибку с дополнительным контекстом
    if (error instanceof ActionHttpError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new Error(`Action ${action} failed: ${error.message}`);
    }
    throw new Error(`Action ${action} failed: Unknown error`);
  }
}

/**
 * Специализированная функция для ingest.startSearch
 *
 * @param payload - Параметры поиска YouTube (query + опциональные фильтры)
 * @returns Promise с результатом создания задачи
 */
export async function startIngestSearch(payload: unknown) {
  return callAction<{ message: string; jobId: string }>(
    "ingest.startSearch",
    payload,
  );
}

// =============================================================================
// Story Templates Actions
// =============================================================================

export async function createStoryTemplate(payload: unknown) {
  return callAction("storyTemplates.create", payload);
}

export async function listStoryTemplates(): Promise<StoryTemplate[]> {
  return callAction<StoryTemplate[]>("storyTemplates.list", {});
}

export async function getStoryTemplateById(
  id: string,
): Promise<StoryTemplateWithBeats> {
  return callAction<StoryTemplateWithBeats>("storyTemplates.getById", { id });
}

export async function updateStoryTemplate(id: string, payload: unknown) {
  return callAction("storyTemplates.update", { id, ...(payload as object) });
}

export async function deleteStoryTemplate(id: string) {
  return callAction("storyTemplates.delete", { id });
}

// =============================================================================
// Characters Actions
// =============================================================================

export async function createCharacter(payload: unknown) {
  return callAction("characters.create", payload);
}

export async function listCharacters(): Promise<Character[]> {
  return callAction<Character[]>("characters.list", {});
}

export async function getCharacterById(id: string) {
  return callAction("characters.getById", { id });
}

export async function updateCharacter(id: string, payload: unknown) {
  return callAction("characters.update", { id, ...(payload as object) });
}

export async function deleteCharacter(id: string) {
  return callAction("characters.delete", { id });
}

// =============================================================================
// Generation Actions
// =============================================================================

export interface StartGenerationProjectResult {
  message?: string;
  project: { id: string; status: string; createdAt: string };
}

export async function startGenerationProject(payload: unknown) {
  return callAction<StartGenerationProjectResult>("generation.startProject", payload);
}

export async function generateKeyframes(payload: unknown) {
  return callAction("generation.generateKeyframes", payload);
}

export async function startAnimation(payload: unknown) {
  return callAction("generation.startAnimation", payload);
}

// =============================================================================
// Projects Actions
// =============================================================================

export type ProjectPreviewWithProvenance = ProjectPreview & {
  contentFormat?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
  storyTemplate?: { id: string; name: string } | null;
};
export async function listProjects(): Promise<ProjectPreviewWithProvenance[]> {
  return callAction<ProjectPreviewWithProvenance[]>("projects.list", {});
}

// =============================================================================
// Models Actions
// =============================================================================

export type ModelType =
  | "text-to-text"
  | "text-to-image"
  | "image-to-video"
  | "text-to-video"
  | "image-to-image"
  | "audio-to-text"
  | "text-to-audio"
  | "multimodal";

export interface ModelWithProvider {
  id: string;
  name: string;
  type: ModelType;
  providerId: string;
  providerName: string;
  isDefault: boolean;
  isEnabled: boolean;
  capabilities: string[] | null;
  costDetails: unknown;
  metadata: unknown;
}

export async function listModels(
  type: ModelType,
): Promise<ModelWithProvider[]> {
  return callAction("models.list", { type });
}

// =============================================================================
// BeamNG Channel Import Actions
// =============================================================================

export interface ImportChannelResult {
  channelId: string;
  channelTitle: string | null;
  videosImported: number;
  videosTotal: number;
  importSessionId: string;
}

export async function importBeamngChannel(payload: {
  input: string;
  maxVideos?: number;
}): Promise<ImportChannelResult> {
  return callAction<ImportChannelResult>("beamng.importChannel", payload);
}
