// packages/hwar-core/src/ai/default-router.ts

import { AiRouter } from './router';
import {
    AnalyzeVideoInput,
    AnalyzeVideoOutput,
    GenerateKeyframeInput,
    GenerateKeyframeOutput,
    GenerateAnimationInput,
    GenerateAnimationOutput,
    AnimationJobStatus
} from './types';
import { loadModelConfig, mergeRequest, deepGet, isOkValue } from './model-config';
import { retryFetch } from './utils/retry';
import { createFirstLastVideoTask, createImageToVideoTask } from '../providers/minimax-video';
import { schema } from '@scrimspec/db';

// Simple logging wrapper to avoid dependency on @repo/logger
const log = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'test') {
        console.log('[ai-default-router]', ...args);
    }
};

export interface DefaultAiRouterConfig {
    geminiApiKey?: string;
    geminiModel?: string;
    minimaxApiKey?: string;
    minimaxGroupId?: string;
    db?: any; // Drizzle client; optional for image/keyframe, required for animation persistence
}

export class DefaultAiRouter implements AiRouter {
    constructor(private config: DefaultAiRouterConfig) { }

    private extractJsonFromText(text: string): string {
        const markdownJsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (markdownJsonMatch) {
            return markdownJsonMatch[1].trim();
        }
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return jsonMatch[0].trim();
        }
        return text.trim();
    }

    private parseGeminiImageResponse(responseJson: any): GenerateKeyframeOutput {
        const candidates = responseJson.candidates ?? [];
        const first = candidates[0];

        if (!first?.content?.parts) {
            throw new Error(`Gemini image response missing content parts`);
        }

        // Search for inlineData or inline_data in any part
        const inlineDataPart = first.content.parts.find(
            (p: any) => p.inlineData || p.inline_data
        );

        const inlineData = inlineDataPart?.inlineData || inlineDataPart?.inline_data;

        if (!inlineData?.data) {
            throw new Error(`Gemini image response has no inlineData.data`);
        }

        const base64 = inlineData.data as string;
        const imageBuffer = Buffer.from(base64, 'base64');

        return {
            imageBuffer,
            externalId: undefined
        };
    }

    async analyzeVideo(input: AnalyzeVideoInput): Promise<AnalyzeVideoOutput> {
        const { videoUrl } = input;
        const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY;
        const model = this.config.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

        if (!apiKey) throw new Error('Gemini API Key not configured');

        const prompt = `Analyze this YouTube Shorts video and output ONLY JSON with keys: hook_text, emotion_tags (5 strings), beats (array of {time_s:number, desc, emotion}), payoff, moral. JSON only, no extra text. Video: ${videoUrl}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                }
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${text}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!candidate) throw new Error('Empty response from Gemini');

        try {
            const jsonStr = this.extractJsonFromText(candidate);
            const result = JSON.parse(jsonStr);
            // Basic validation
            if (!result.hook_text || !result.beats) throw new Error('Invalid JSON structure');
            return result as AnalyzeVideoOutput;
        } catch (e) {
            throw new Error(`Failed to parse Gemini response: ${e}`);
        }
    }

    async generateKeyframe(input: GenerateKeyframeInput): Promise<GenerateKeyframeOutput> {
        const { prompt, negativePrompt, aspectRatio, modelId } = input;

        // 1. Load model config
        let targetModelId = modelId;
        if (!targetModelId) {
            throw new Error('modelId is required for generateKeyframe');
        }

        const cfg = await loadModelConfig(targetModelId);

        // 2. Get API Key
        const apiKey = process.env[cfg.apiKeyEnvVarName];
        if (!apiKey) {
            throw new Error(`Missing API key in env: ${cfg.apiKeyEnvVarName} for provider ${cfg.providerId}`);
        }

        // 3. Prepare Payload
        let payload: Record<string, any>;

        if (cfg.providerId === 'google_gemini' && cfg.type === 'text-to-image') {
            // payload strictly per new Gemini spec
            const basePayload = {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: negativePrompt
                                    ? `${prompt}\n\nNegative prompt: ${negativePrompt}`
                                    : prompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    responseModalities: ['IMAGE'],
                    imageConfig: aspectRatio ? { aspectRatio } : undefined,
                },
            };

            payload = basePayload; // No mergeRequest here
        } else {
            const rawPayload: Record<string, any> = {
                model: cfg.modelId,
                prompt,
                aspect_ratio: aspectRatio,
            };

            if (negativePrompt) {
                rawPayload.negative_prompt = negativePrompt;
            }

            payload = mergeRequest(rawPayload, cfg.requestDefaults);
        }

        if (process.env.NODE_ENV !== 'test') {
            log({ tag: 'ai-image-request-payload', provider: cfg.providerId, modelId: cfg.modelId, payload });
        }

        // 4. Prepare Request
        // Fix: Ensure we have a valid API base URL, with proper fallbacks for different providers
        let apiUrl = cfg.apiBaseUrl;
        if (!apiUrl) {
            // Set appropriate default URLs based on provider
            switch (cfg.providerId) {
                case 'google_gemini':
                    apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
                    break;
                case 'minimax':
                    apiUrl = 'https://api.minimax.io/v1';
                    break;
                default:
                    throw new Error(`No API base URL configured for provider ${cfg.providerId}`);
            }
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        switch (cfg.authenticationType) {
            case 'bearer_token':
                headers['Authorization'] = `Bearer ${apiKey}`;
                break;
            case 'api_key_header':
                headers['X-API-Key'] = apiKey;
                break;
            case 'query_param':
                // Handled in URL construction below
                break;
            default:
                throw new Error(`Unsupported auth type: ${cfg.authenticationType}`);
        }

        // Construct the final URL properly based on provider
        let finalUrl: string;
        if (cfg.providerId === 'google_gemini') {
            if (!apiKey) {
                throw new Error('Google Gemini API key is missing in model config');
            }

            // Base URL may be configured as just the host or already include /v1 or /v1beta/models.
            // Normalize it so we always end up with ".../v1beta/models/<modelId>:generateContent"
            const rawBase =
                cfg.apiBaseUrl && cfg.apiBaseUrl.length > 0
                    ? cfg.apiBaseUrl
                    : 'https://generativelanguage.googleapis.com';

            const cleanedBase = rawBase.replace(/\/$/, '');

            let modelsBase: string;
            if (/\/v\d[^/]*\/models$/.test(cleanedBase)) {
                // apiBaseUrl is already something like ".../v1beta/models"
                modelsBase = cleanedBase;
            } else if (/\/v\d[^/]*$/.test(cleanedBase)) {
                // apiBaseUrl is like ".../v1beta" → append "/models"
                modelsBase = `${cleanedBase}/models`;
            } else {
                // apiBaseUrl is just the host → append full "/v1beta/models"
                modelsBase = `${cleanedBase}/v1beta/models`;
            }

            finalUrl = `${modelsBase}/${cfg.modelId}:generateContent?key=${apiKey}`;

            log({
                tag: 'ai-image-request',
                provider: cfg.providerId,
                modelId: cfg.modelId,
                url: finalUrl,
                msg: 'AI image request debug (google_gemini fixed URL)',
            });
        } else if (cfg.authenticationType === 'query_param') {
            const urlObj = new URL(apiUrl);
            urlObj.searchParams.set('key', apiKey);
            finalUrl = urlObj.toString();
        } else {
            finalUrl = apiUrl;
        }

        // 5. Execute Request with Retry
        const response = await retryFetch(async () => {
            const res = await fetch(finalUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`API error: ${res.status} ${res.statusText} - ${errorText}`);
            }
            return res.json();
        }, console as any); // TODO: Pass proper logger

        if (process.env.NODE_ENV !== 'test') {
            log({
                tag: 'ai-image-response-raw',
                provider: cfg.providerId,
                modelId: cfg.modelId,
                response: response,
            });
        }

        if (cfg.providerId === 'google_gemini' && cfg.type === 'text-to-image') {
            return this.parseGeminiImageResponse(response);
        }

        // 6. Validate Response
        const adapter = cfg.responseAdapter ?? {};
        const okVal = deepGet(response, adapter.okPath);
        if (!isOkValue(okVal, adapter.okValues)) {
            const errMsg = deepGet(response, adapter.errorPath) ?? 'Unknown provider error';
            throw new Error(`Model ${cfg.modelId} error: ${String(errMsg)}`);
        }

        // 7. Extract Data
        const dataPaths = adapter.dataPaths ?? {};
        const externalId = deepGet(response, dataPaths.task_id);
        const b64 = deepGet(response, dataPaths.image_base64);
        const url = deepGet(response, dataPaths.url);

        let imageBuffer: Buffer;

        if (typeof b64 === 'string' && b64.length > 0) {
            imageBuffer = Buffer.from(b64, 'base64');
        } else if (typeof url === 'string' && url.length > 0) {
            const imgRes = await fetch(url);
            if (!imgRes.ok) throw new Error(`Failed to download image from ${url}`);
            const arrayBuffer = await imgRes.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
        } else {
            // If we have an externalId (async task), we might not have an image yet.
            if (externalId) {
                // Return empty buffer for now, handler will handle it
                imageBuffer = Buffer.alloc(0);
            } else {
                throw new Error(`Model ${cfg.modelId} responded OK but no data found`);
            }
        }

        return {
            imageBuffer,
            externalId: externalId ? String(externalId) : undefined
        };
    }

    async generateAnimation(input: GenerateAnimationInput): Promise<GenerateAnimationOutput> {
        const { keyframes, projectId, sceneIndex, prompt, modelId, durationSec, resolution } = input;

        if (!keyframes || keyframes.length === 0) {
            throw new Error('No keyframes provided for animation');
        }

        const first = keyframes[0];
        const last = keyframes[keyframes.length - 1];
        if (!first?.publicUrl) {
            throw new Error('First keyframe must include publicUrl');
        }

        const useFirstLast = keyframes.length >= 2 && !!last?.publicUrl;

        const model = modelId ?? 'MiniMax-Hailuo-02';
        const duration = durationSec ?? 6;
        const requestedResolution = resolution ?? '768P';

        // API supports 768P/1080P for first+last. For single-frame fallback allow broader union but coerce.
        const resolutionFirstLast = requestedResolution === '1080P' ? '1080P' : '768P';
        const resolutionSingle = requestedResolution;

        const task = useFirstLast
            ? await createFirstLastVideoTask({
                model,
                firstFrameUrl: first.publicUrl,
                lastFrameUrl: last!.publicUrl,
                prompt,
                duration,
                resolution: resolutionFirstLast,
                promptOptimizer: true,
            })
            : await createImageToVideoTask({
                model,
                firstFrameUrl: first.publicUrl,
                prompt,
                duration,
                resolution: resolutionSingle,
                promptOptimizer: true,
            });

        if (process.env.NODE_ENV !== 'test') {
            console.log('[ai-default-router] minimax video_generation response', JSON.stringify(task));
        }

        if (!task || task.base_resp?.status_code !== 0 || !task.task_id) {
            const code = task?.base_resp?.status_code;
            const msg = task?.base_resp?.status_msg || 'Unknown MiniMax error';
            throw new Error(`MiniMax video_generation error: ${code} ${msg}`);
        }

        const db = this.config.db;
        if (!db) {
            throw new Error('DefaultAiRouter is not configured with db; cannot persist animation job');
        }

        const status: AnimationJobStatus = 'queued';

        const animationJobsTable = (schema as any).generationAnimationJobs;

        await db.insert(animationJobsTable).values({
            projectId,
            sceneIndex,
            provider: 'minimax',
            model,
            minimaxTaskId: task.task_id,
            status,
            resolution: useFirstLast ? resolutionFirstLast : resolutionSingle,
            durationSec: duration,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        return {
            provider: 'minimax',
            model,
            externalTaskId: task.task_id,
            status,
        };
    }
}
