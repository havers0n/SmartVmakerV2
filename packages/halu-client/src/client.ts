/**
 * MiniMax HALU API Client
 *
 * A typed TypeScript client for the MiniMax HALU video generation API.
 * Supports both Subject-Reference (S2V-01) and First & Last Frame (MiniMax-Hailuo-02) modes.
 */

import {
  HaluClientConfig,
  CreateVideoTaskResponse,
  QueryVideoTaskResponse,
  RetrieveFileResponse,
  SubjectReferenceVideoRequest,
  FirstLastFrameVideoRequest,
  TextToImageRequest,
  ImageToImageRequest,
  ImageGenerationResponse,
  HaluApiError,
  MinimaxErrorCode,
} from './types';

/**
 * Default configuration values
 */
const DEFAULT_BASE_URL = 'https://api.minimax.io/v1';
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds

/**
 * HALU API Client
 */
export class HaluClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: HaluClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;

    if (!this.apiKey) {
      throw new Error('HALU API key is required');
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Make an authenticated request to the HALU API
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse response
      const data = await response.json() as any;

      // Check for API errors
      if (!response.ok) {
        throw new HaluApiError(
          data.base_resp?.status_msg || `HTTP ${response.status}`,
          data.base_resp?.status_code || response.status,
          data.base_resp?.status_msg || response.statusText,
          data
        );
      }

      // Check base_resp status code
      if (data.base_resp && data.base_resp.status_code !== MinimaxErrorCode.SUCCESS) {
        throw new HaluApiError(
          data.base_resp.status_msg || 'API request failed',
          data.base_resp.status_code,
          data.base_resp.status_msg,
          data
        );
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof HaluApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${DEFAULT_TIMEOUT_MS}ms`);
        }
        throw error;
      }

      throw new Error('Unknown error occurred during API request');
    }
  }

  // ==========================================================================
  // Public API Methods
  // ==========================================================================

  /**
   * Create a Subject-Reference to Video generation task (S2V-01)
   *
   * @param payload - Request payload for S2V video generation
   * @returns Task creation response with task_id
   *
   * @example
   * ```ts
   * const response = await client.createSubjectReferenceTask({
   *   model: 'S2V-01',
   *   prompt: 'A girl runs toward the camera and winks with a smile.',
   *   prompt_optimizer: true,
   *   subject_reference: [{
   *     type: 'character',
   *     image: ['https://example.com/character.jpg']
   *   }],
   *   callback_url: 'https://your.domain.com/webhook'
   * });
   * console.log('Task ID:', response.task_id);
   * ```
   */
  async createSubjectReferenceTask(
    payload: SubjectReferenceVideoRequest
  ): Promise<CreateVideoTaskResponse> {
    return this.request<CreateVideoTaskResponse>('/video_generation', 'POST', payload);
  }

  /**
   * Create a First & Last Frame video generation task (MiniMax-Hailuo-02)
   *
   * @param payload - Request payload for first/last frame video generation
   * @returns Task creation response with task_id
   *
   * @example
   * ```ts
   * const response = await client.createFirstLastFrameTask({
   *   model: 'MiniMax-Hailuo-02',
   *   prompt: 'A little girl grow up. [Push in],[Pan right]',
   *   first_frame_image: 'https://example.com/first.jpg',
   *   last_frame_image: 'https://example.com/last.jpg',
   *   duration: 6,
   *   resolution: '768P',
   *   prompt_optimizer: true,
   *   callback_url: 'https://your.domain.com/webhook'
   * });
   * console.log('Task ID:', response.task_id);
   * ```
   */
  async createFirstLastFrameTask(
    payload: FirstLastFrameVideoRequest
  ): Promise<CreateVideoTaskResponse> {
    return this.request<CreateVideoTaskResponse>('/video_generation', 'POST', payload);
  }

  /**
   * Generate image from text description (Text-to-Image)
   *
   * @param payload - Request payload for text-to-image generation
   * @returns Image generation response with image data
   *
   * @example
   * ```ts
   * const response = await client.generateImage({
   *   model: 'image-01',
   *   prompt: 'A beautiful sunset over the ocean',
   *   aspect_ratio: '16:9',
   *   response_format: 'base64'
   * });
   * 
   * // Save base64 image to file
   * const imageData = response.data[0].image_base64;
   * const imageBuffer = Buffer.from(imageData, 'base64');
   * fs.writeFileSync('image.png', imageBuffer);
   * ```
   */
  async generateImage(
    payload: TextToImageRequest
  ): Promise<ImageGenerationResponse> {
    return this.request<ImageGenerationResponse>('/image_generation', 'POST', payload);
  }

  /**
   * Generate image from source image and text modification (Image-to-Image)
   *
   * @param payload - Request payload for image-to-image generation
   * @returns Image generation response with image data
   *
   * @example
   * ```ts
   * const response = await client.modifyImage({
   *   model: 'image-01',
   *   prompt: 'Make the sky more blue and add clouds',
   *   image: 'https://example.com/source-image.jpg',
   *   aspect_ratio: '16:9',
   *   response_format: 'url'
   * });
   * 
   * // Get image URL
   * const imageUrl = response.data[0].url;
   * ```
   */
  async modifyImage(
    payload: ImageToImageRequest
  ): Promise<ImageGenerationResponse> {
    return this.request<ImageGenerationResponse>('/image_generation', 'POST', payload);
  }

  /**
   * Query the status of a video generation task
   *
   * @param taskId - The task_id returned from task creation
   * @returns Task status information
   *
   * @example
   * ```ts
   * const status = await client.queryTask('106916112212032');
   *
   * if (status.status === 'success') {
   *   console.log('Video ready!', status.file_id || status.video_url);
   * } else if (status.status === 'failed') {
   *   console.error('Generation failed');
   * } else {
   *   console.log('Still processing...');
   * }
   * ```
   */
  async queryTask(taskId: string): Promise<QueryVideoTaskResponse> {
    return this.request<QueryVideoTaskResponse>(`/query/video_generation?task_id=${taskId}`, 'GET');
  }

  /**
   * Retrieve file information and download URL by file_id
   *
   * @param fileId - The file_id returned from a successful task
   * @returns File information including temporary download URL
   *
   * @example
   * ```ts
   * const fileInfo = await client.retrieveFile('file_abc123');
   * console.log('Download URL:', fileInfo.file.download_url);
   *
   * // Download the file
   * const videoResponse = await fetch(fileInfo.file.download_url);
   * const videoBlob = await videoResponse.blob();
   * ```
   */
  async retrieveFile(fileId: string): Promise<RetrieveFileResponse> {
    return this.request<RetrieveFileResponse>(`/files/retrieve?file_id=${fileId}`, 'GET');
  }

  /**
   * Download video file directly as a Buffer
   *
   * @param fileIdOrUrl - Either a file_id or a direct video_url
   * @returns Buffer containing the video file
   *
   * @example
   * ```ts
   * // Using file_id
   * const videoBuffer = await client.downloadVideo('file_abc123');
   *
   * // Or using direct URL
   * const videoBuffer = await client.downloadVideo('https://cdn.example.com/video.mp4');
   * ```
   */
  async downloadVideo(fileIdOrUrl: string): Promise<Buffer> {
    let downloadUrl: string;

    // Check if it's a URL or a file_id
    if (fileIdOrUrl.startsWith('http://') || fileIdOrUrl.startsWith('https://')) {
      downloadUrl = fileIdOrUrl;
    } else {
      // It's a file_id, retrieve the download URL
      const fileInfo = await this.retrieveFile(fileIdOrUrl);
      downloadUrl = fileInfo.file.download_url;
    }

    // Download the video
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`Failed to download video: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Poll a task until completion or failure
   *
   * @param taskId - The task_id to poll
   * @param options - Polling options
   * @returns Final task status
   *
   * @example
   * ```ts
   * const result = await client.pollTask('106916112212032', {
   *   intervalMs: 5000,
   *   maxAttempts: 60,
   *   onProgress: (status) => {
   *     console.log('Current status:', status.status);
   *   }
   * });
   *
   * if (result.status === 'success') {
   *   const video = await client.downloadVideo(result.file_id!);
   * }
   * ```
   */
  async pollTask(
    taskId: string,
    options?: {
      intervalMs?: number; // Default: 5000 (5 seconds)
      maxAttempts?: number; // Default: 60 (5 minutes total)
      onProgress?: (status: QueryVideoTaskResponse) => void;
    }
  ): Promise<QueryVideoTaskResponse> {
    const intervalMs = options?.intervalMs || 5000;
    const maxAttempts = options?.maxAttempts || 60;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await this.queryTask(taskId);

      // Call progress callback if provided
      if (options?.onProgress) {
        options.onProgress(status);
      }

      // Check if task is complete
      if (status.status === 'success' || status.status === 'failed') {
        return status;
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Task polling timeout after ${maxAttempts} attempts`);
  }

  /**
   * Validate webhook challenge request
   *
   * @param challenge - The challenge string from the webhook
   * @returns The same challenge string to echo back
   *
   * @example
   * ```ts
   * // In your webhook handler:
   * app.post('/webhook', async (req, res) => {
   *   const payload = req.body;
   *
   *   if ('challenge' in payload) {
   *     const response = HaluClient.handleWebhookChallenge(payload.challenge);
   *     return res.json(response);
   *   }
   *
   *   // Handle status update...
   * });
   * ```
   */
  static handleWebhookChallenge(challenge: string): { challenge: string } {
    return { challenge };
  }
}

/**
 * Create a HALU client instance
 *
 * @param config - Client configuration
 * @returns Configured HALU client
 *
 * @example
 * ```ts
 * const client = createHaluClient({
 *   apiKey: process.env.MINIMAX_API_KEY!
 * });
 * ```
 */
export function createHaluClient(config: HaluClientConfig): HaluClient {
  return new HaluClient(config);
}
