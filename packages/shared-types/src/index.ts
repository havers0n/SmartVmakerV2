/**
 * Scrimspec Shared Types
 * Central type definitions for the entire monorepo
 */

// Export HWAR types
export * from './hwar';

// ============================================================================
// TASK TYPES
// ============================================================================

export type TaskStatus = 'queued' | 'processing' | 'success' | 'failed';
export type TaskKind = 't2v' | 'i2v' | 'startend' | 't2i' | 'tts' | 't2a' | 'voice-clone' | 'compose' | 'template';

export interface Task {
  id: string;
  kind: TaskKind;
  status: TaskStatus;
  prompt?: string;
  params?: Record<string, unknown>;
  fileId?: string;
  publicUrl?: string;
  errorText?: string;
  batchId?: string;
  topic?: string;
  lang?: string;
  startedAt: Date;
  finishedAt?: Date;
}

// ============================================================================
// VIDEO GENERATION TYPES
// ============================================================================

export type VideoResolution = '1080P' | '768P' | '512P';
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:2' | '2:3' | '3:4' | '21:9';

export interface TextToVideoRequest {
  prompt: string;
  duration?: 6 | 10;
  resolution?: VideoResolution;
  aspectRatio?: AspectRatio;
  model?: string;
}

export interface ImageToVideoRequest {
  firstFrameImage: string; // URL or base64
  prompt?: string;
  duration?: 6 | 10;
  resolution?: VideoResolution;
  aspectRatio?: AspectRatio;
  model?: string;
}

export interface StartEndVideoRequest {
  startFrameImage: string; // URL or base64
  endFrameImage: string;   // URL or base64
  prompt?: string;
  duration?: 6 | 10;
  resolution?: VideoResolution;
  aspectRatio?: AspectRatio;
  model?: string;
}

// ============================================================================
// IMAGE GENERATION TYPES
// ============================================================================

export interface TextToImageRequest {
  prompt: string;
  model?: string;
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
  n?: number; // 1-9, default 1
  promptOptimizer?: boolean;
}

// ============================================================================
// AUDIO GENERATION TYPES
// ============================================================================

export interface TextToSpeechRequest {
  text: string;
  model?: string;
  voiceId?: string;
  voiceSetting?: {
    speed?: number;
    vol?: number;
    pitch?: number;
  };
  audioSetting?: {
    audioSampleRate?: number;
    bitrate?: number;
    format?: string;
    channel?: number;
  };
}

export interface VoiceCloneRequest {
  voiceFile: string; // URL or base64
  voiceId?: string;
  text?: string;
  model?: string;
}

// ============================================================================
// VIDEO COMPOSITION
// ============================================================================

export interface ClipInfo {
  taskId: string;
  duration?: number;
  url?: string;
}

export interface ComposeRequest {
  clips: ClipInfo[];
  audioUrl?: string;
  transitions?: {
    duration?: number;
    type?: string;
  };
}

// ============================================================================
// TEMPLATE GENERATION
// ============================================================================

export interface TemplateRequest {
  templateId: string;
  params: Record<string, string | number | boolean>;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface APIError {
  code?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  taskId?: string;
}

export interface JobStatusResponse {
  taskId: string;
  status: TaskStatus;
  fileId?: string;
  publicUrl?: string;
  errorText?: string;
  progress?: number;
}

// ============================================================================
// MINIMAX API RESPONSE TYPES
// ============================================================================

export interface MiniMaxBaseResponse {
  status_code: number;
  status_msg: string;
  request_id?: string;
}

export interface MiniMaxAsyncResponse extends MiniMaxBaseResponse {
  task_id: string;
}

export interface MiniMaxFileResponse extends MiniMaxBaseResponse {
  file_id: string;
  file_name?: string;
}

export interface MiniMaxVideoResponse extends MiniMaxAsyncResponse {
  task_id: string;
}

// ============================================================================
// DATABASE TYPES (Drizzle)
// ============================================================================

export interface TaskRecord {
  id: string;
  kind: TaskKind;
  status: TaskStatus;
  prompt?: string;
  params?: unknown;
  fileId?: string;
  publicUrl?: string;
  errorText?: string;
  batchId?: string;
  topic?: string;
  lang?: string;
  startedAt: Date;
  finishedAt?: Date;
}

export interface ClipRecord {
  id: string;
  taskId: string;
  beatId?: string;
  publicUrl?: string;
  durationS?: number;
}

export interface BatchRecord {
  id: string;
  planPath?: string;
  status: TaskStatus;
  total: number;
  ok: number;
  fail: number;
  avgTimeMs?: number;
  qualityScore?: number;
  startedAt: Date;
  finishedAt?: Date;
}

export interface AssetRecord {
  id: string;
  kind: string;
  prompt?: string;
  aspectRatio?: string;
  model?: string;
  url?: string;
  createdAt: Date;
}

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface ServerConfig {
  port: number;
  publicBaseUrl: string;
  nodeEnv: 'development' | 'production' | 'test';
}

export interface APIConfig {
  baseUrl: string;
  key: string;
  timeout?: number;
}

export interface DatabaseConfig {
  url?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  anonKey?: string;
}

export interface CORSConfig {
  origins: string[];
}

export interface Config {
  server: ServerConfig;
  api: APIConfig;
  database: DatabaseConfig;
  cors: CORSConfig;
}

// ============================================================================
// REQUEST/RESPONSE HELPERS
// ============================================================================

export type RequestPayload =
  | TextToVideoRequest
  | ImageToVideoRequest
  | StartEndVideoRequest
  | TextToImageRequest
  | TextToSpeechRequest
  | VoiceCloneRequest
  | ComposeRequest
  | TemplateRequest;

export type ResponsePayload<T = unknown> =
  | APIResponse<T>
  | JobStatusResponse
  | MiniMaxAsyncResponse
  | MiniMaxFileResponse;
