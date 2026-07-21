/**
 * MiniMax HALU API Type Definitions
 * Based on documentation from docs/hailouapi/api.md
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Base response structure from MiniMax API
 */
export interface BaseResponse {
  status_code: number;
  status_msg: string;
}

/**
 * MiniMax API error codes
 */
export enum MinimaxErrorCode {
  SUCCESS = 0,
  RATE_LIMIT = 1002,
  AUTH_ERROR = 1004,
  INSUFFICIENT_FUNDS = 1008,
  SENSITIVE_CONTENT = 1026,
  INVALID_PARAMS = 2013,
  INVALID_API_KEY = 2049,
}

// ============================================================================
// Subject-Reference to Video (S2V) Types
// ============================================================================

/**
 * Subject reference for character-based video generation
 */
export interface SubjectReference {
  type: 'character';
  image: [string]; // Exactly 1 image URL or Data URL
}

/**
 * Request payload for Subject-Reference video generation
 */
export interface SubjectReferenceVideoRequest {
  model: 'S2V-01';
  prompt?: string; // Up to ~2000 characters
  prompt_optimizer?: boolean; // Default: true
  subject_reference: [SubjectReference]; // Exactly 1 subject
  callback_url?: string;
}

// ============================================================================
// First & Last Frame Video Generation Types
// ============================================================================

/**
 * Available resolutions for video generation
 */
export type VideoResolution = '768P' | '1080P';

/**
 * Available video durations (in seconds)
 * - 768P: 6 or 10 seconds
 * - 1080P: 6 seconds only
 */
export type VideoDuration = 6 | 10;

/**
 * Camera movement commands for MiniMax-Hailuo-02
 */
export type CameraMovement =
  | 'Truck left'
  | 'Truck right'
  | 'Pan left'
  | 'Pan right'
  | 'Push in'
  | 'Pull out'
  | 'Pedestal up'
  | 'Pedestal down'
  | 'Tilt up'
  | 'Tilt down'
  | 'Zoom in'
  | 'Zoom out'
  | 'Shake'
  | 'Tracking shot'
  | 'Static shot';

/**
 * Request payload for First & Last Frame video generation
 */
export interface FirstLastFrameVideoRequest {
  model: 'MiniMax-Hailuo-02';
  prompt?: string; // Up to ~2000 characters, supports camera commands in []
  first_frame_image?: string; // URL or Data URL (Base64)
  last_frame_image: string; // URL or Data URL (Base64) - REQUIRED
  prompt_optimizer?: boolean; // Default: true
  duration?: VideoDuration; // Default: 6
  resolution?: VideoResolution; // Default: '768P'
  callback_url?: string;
}

// ============================================================================
// Image Generation Types
// ============================================================================

/**
 * Aspect ratios for image generation
 */
export type ImageAspectRatio = '1:1' | '16:9' | '9:16' | '3:2' | '2:3' | '4:3' | '3:4' | '21:9' | '9:21';

/**
 * Response format for image generation
 */
export type ImageResponseFormat = 'url' | 'base64';

/**
 * Request payload for text-to-image generation
 */
export interface TextToImageRequest {
  model: 'image-01';
  prompt: string; // Detailed text description
  aspect_ratio?: ImageAspectRatio; // Default: '16:9'
  response_format?: ImageResponseFormat; // Default: 'url'
  prompt_optimizer?: boolean; // Default: true
}

/**
 * Request payload for image-to-image generation
 */
export interface ImageToImageRequest {
  model: 'image-01';
  prompt: string; // Modification instructions
  image: string; // Source image URL or Data URL (Base64)
  aspect_ratio?: ImageAspectRatio; // Default: '16:9'
  response_format?: ImageResponseFormat; // Default: 'url'
  prompt_optimizer?: boolean; // Default: true
}

/**
 * Image data in response
 */
export interface ImageData {
  url?: string; // When response_format is 'url'
  image_base64?: string; // When response_format is 'base64'
}

/**
 * Response from image generation
 */
export interface ImageGenerationResponse {
  created: number; // Unix timestamp
  data: ImageData[];
  base_resp: BaseResponse;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response from video generation task creation
 */
export interface CreateVideoTaskResponse {
  task_id: string;
  base_resp: BaseResponse;
}

/**
 * Video generation task status
 */
export type VideoTaskStatus = 'processing' | 'success' | 'failed';

/**
 * Response from querying video generation task
 */
export interface QueryVideoTaskResponse {
  task_id: string;
  status: VideoTaskStatus;
  file_id?: string; // Available when status is 'success'
  video_url?: string; // Alternative to file_id
  base_resp: BaseResponse;
}

/**
 * Webhook challenge request
 */
export interface WebhookChallengeRequest {
  challenge: string;
}

/**
 * Webhook challenge response
 */
export interface WebhookChallengeResponse {
  challenge: string;
}

/**
 * Webhook status update payload (same structure as QueryVideoTaskResponse)
 */
export type WebhookStatusUpdate = QueryVideoTaskResponse;

// ============================================================================
// File Retrieval Types
// ============================================================================

/**
 * Response from file retrieval endpoint
 */
export interface RetrieveFileResponse {
  file: {
    file_id: string;
    bytes: number;
    created_at: number;
    filename: string;
    purpose: string;
    download_url: string; // Temporary download URL
  };
  base_resp: BaseResponse;
}

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * Configuration for HALU API client
 */
export interface HaluClientConfig {
  apiKey: string;
  baseUrl?: string; // Default: 'https://api.minimax.io/v1'
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * HALU API Error
 */
export class HaluApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public statusMsg: string,
    public response?: any
  ) {
    super(message);
    this.name = 'HaluApiError';
  }
}
