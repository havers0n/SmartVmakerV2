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
import { SuspendJobError } from '../jobs/types';

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
    private providerCooldownUntil: Map<string, number> = new Map();

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

        // Circuit Breaker check
        const cooldown = this.providerCooldownUntil.get('google_gemini');
        if (cooldown && cooldown > Date.now()) {
            throw new SuspendJobError(`Provider google_gemini is cooling down until ${new Date(cooldown).toISOString()}`, new Date(cooldown));
        }

        const prompt = `Analyze this YouTube Shorts video and output ONLY JSON with keys: hook_text, emotion_tags (5 strings), beats (array of {time_s:number, desc, emotion}), payoff, moral. JSON only, no extra text. Video: ${videoUrl}`;

        // Security: Use header instead of query param to avoid leak in logs
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        try {
            const rawResponse = await retryFetch(async () => {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey
                    },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            responseMimeType: "application/json",
                        }
                    })
                });

                if (!response.ok) {
                    const text = await response.text();
                    let errObj: any;
                    try { errObj = JSON.parse(text); } catch { }

                    // Handle 429
                    if (response.status === 429) {
                        const status = errObj?.error?.status;
                        const message = errObj?.error?.message || text;

                        // Quota exhausted (fatal/long-term)
                        if (status === 'RESOURCE_EXHAUSTED' || message.includes('quota')) {
                            const isLimitZero = message.includes('limit: 0');
                            const cooldownMs = isLimitZero ? 3600000 : 60000; // 1h if limit 0, 1m otherwise
                            const retryAt = new Date(Date.now() + cooldownMs);
                            this.providerCooldownUntil.set('google_gemini', retryAt.getTime());
                            throw new SuspendJobError(`Gemini Quota Exhausted: ${message}`, retryAt);
                        }
                    }

                    throw new Error(`Gemini API error: ${response.status} - ${text}`);
                }

                return response.json();
            }, console as any, { retries: 1 });

            const candidate = rawResponse.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!candidate) throw new Error('Empty response from Gemini');

            const jsonStr = this.extractJsonFromText(candidate);
            const result = JSON.parse(jsonStr);
            if (!result.hook_text || !result.beats) throw new Error('Invalid JSON structure');
            return result as AnalyzeVideoOutput;

        } catch (e: any) {
            if (e instanceof SuspendJobError) throw e;
            throw new Error(`Failed to analyze video: ${e.message}`);
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
        // Rule: BASE_URL = origin (without version), version always in path
        let apiBaseUrl = cfg.apiBaseUrl;
        if (!apiBaseUrl) {
            // Set appropriate default URLs based on provider (origin only, no version)
            switch (cfg.providerId) {
                case 'google_gemini':
                    apiBaseUrl = 'https://generativelanguage.googleapis.com';
                    break;
                case 'minimax':
                    apiBaseUrl = 'https://api.minimax.io';
                    break;
                default:
                    throw new Error(`No API base URL configured for provider ${cfg.providerId}`);
            }
        }

        // Normalize: remove trailing slash and any /v1, /v1beta from base URL
        // Narrow regex: only match /v followed by digits at the end, not /v1beta or /v1/...
        apiBaseUrl = apiBaseUrl.replace(/\/$/, '').replace(/\/v\d+$/, '');

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
        // Rule: BASE_URL = origin, version always in path
        let finalUrl: string;
        if (cfg.providerId === 'google_gemini') {
            if (!apiKey) {
                throw new Error('Google Gemini API key is missing in model config');
            }

            // Gemini: always use /v1beta/models/<modelId>:generateContent
            // Security: DON'T put key in URL, we put it in header 'x-goog-api-key' now
            finalUrl = `${apiBaseUrl}/v1beta/models/${cfg.modelId}:generateContent`;
            headers['x-goog-api-key'] = apiKey;

        } else if (cfg.providerId === 'minimax') {
            // MiniMax: always use /v1/image_generation for text-to-image
            // Path is always /v1/image_generation (version in path, not in base URL)
            finalUrl = `${apiBaseUrl}/v1/image_generation`;
        } else if (cfg.authenticationType === 'query_param') {
            const urlObj = new URL(apiBaseUrl);
            urlObj.searchParams.set('key', apiKey);
            finalUrl = urlObj.toString();
        } else {
            // For other providers, use base URL as-is (should include full path if needed)
            finalUrl = apiBaseUrl;
        }

        // Log final URL (with potential REDACTION if key is in query string)
        let logUrl = finalUrl;
        try {
            const urlObj = new URL(finalUrl);
            if (urlObj.searchParams.has('key')) {
                urlObj.searchParams.set('key', '***');
                logUrl = urlObj.toString();
            }
        } catch { }

        // Log safe headers - no secrets
        const safeHeaders = { ...headers };
        ['Authorization', 'X-API-Key', 'x-goog-api-key'].forEach(h => {
            if (safeHeaders[h]) safeHeaders[h] = '***';
        });

        log({
            tag: 'ai-image-request',
            provider: cfg.providerId,
            modelId: cfg.modelId,
            url: logUrl,
            method: 'POST',
            headers: safeHeaders,
        });

        // 5. Execute Request with Retry
        const executeCall = async (targetUrl: string, targetHeaders: Record<string, string>, targetPayload: any, provider: string, model: string) => {
            // Circuit Breaker check
            const cooldown = this.providerCooldownUntil.get(provider);
            if (cooldown && cooldown > Date.now()) {
                throw new SuspendJobError(`Provider ${provider} is cooling down until ${new Date(cooldown).toISOString()}`, new Date(cooldown));
            }

            try {
                const response = await retryFetch(async () => {
                    const res = await fetch(targetUrl, {
                        method: 'POST',
                        headers: targetHeaders,
                        body: JSON.stringify(targetPayload)
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        let errObj: any;
                        try { errObj = JSON.parse(errorText); } catch { }

                        if (res.status === 429) {
                            // Extract cooldown from RetryInfo if available
                            let retryDelaySec = 60; // default 1m
                            const retryInfo = errObj?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
                            if (retryInfo?.retryDelay) {
                                // retryDelay is usually a string like "30s" or "30.5s"
                                const match = retryInfo.retryDelay.match(/([\d.]+)s/);
                                if (match) retryDelaySec = parseFloat(match[1]);
                            }

                            // Quota exhausted check
                            const status = errObj?.error?.status;
                            const message = errObj?.error?.message || errorText;

                            if (status === 'RESOURCE_EXHAUSTED' || message.includes('quota')) {
                                // P1 LOG: capture violations for preview-image hypothesis
                                if (process.env.NODE_ENV !== 'test') {
                                    log({
                                        tag: 'ai-quota-exhausted-details',
                                        requestedModel: cfg.modelId,
                                        actualViolations: errObj?.error?.details?.filter((d: any) => d['@type']?.includes('QuotaFailure'))
                                    });
                                }

                                const isLimitZero = message.includes('limit: 0');
                                const totalDelaySec = isLimitZero ? 3600 : retryDelaySec;
                                const retryAt = new Date(Date.now() + totalDelaySec * 1000);
                                this.providerCooldownUntil.set(provider, retryAt.getTime());
                                throw new SuspendJobError(`Quota exhausted for ${provider}: ${message}`, retryAt);
                            }

                            // Transient 429
                            const retryAt = new Date(Date.now() + retryDelaySec * 1000);
                            throw new SuspendJobError(`Rate limited for ${provider}: ${message}`, retryAt);
                        }

                        throw new Error(`API error: ${res.status} ${res.statusText} - ${errorText}`);
                    }
                    return res.json();
                }, console as any, { retries: 1 });

                if (process.env.NODE_ENV !== 'test') {
                    log({
                        tag: 'ai-image-response-raw',
                        provider,
                        modelId: model,
                        response: response,
                    });
                }

                if (provider === 'google_gemini' && cfg.type === 'text-to-image') {
                    return this.parseGeminiImageResponse(response);
                }

                // 6. Validate Response
                const adapter = cfg.responseAdapter ?? {};
                const okVal = deepGet(response, adapter.okPath);
                if (!isOkValue(okVal, adapter.okValues)) {
                    const errMsg = deepGet(response, adapter.errorPath) ?? 'Unknown provider error';
                    throw new Error(`Model ${model} error: ${String(errMsg)}`);
                }

                // 7. Extract Data
                const dataPaths = adapter.dataPaths ?? {};
                const externalId = deepGet(response, dataPaths.task_id);
                const resultUrl = deepGet(response, dataPaths.url);

                let imageBase64: string | undefined;

                if (provider === 'minimax') {
                    const arr = (response as any)?.data?.image_base64;
                    if (Array.isArray(arr) && typeof arr[0] === 'string' && arr[0].length > 0) imageBase64 = arr[0];
                    else if (typeof arr === 'string' && arr.length > 0) imageBase64 = arr;
                } else {
                    const b64 = deepGet(response, dataPaths.image_base64);
                    if (typeof b64 === 'string' && b64.length > 0) imageBase64 = b64;
                }

                let imageBuffer: Buffer;
                if (imageBase64) {
                    imageBuffer = Buffer.from(imageBase64, 'base64');
                } else if (typeof resultUrl === 'string' && resultUrl.length > 0) {
                    const imgRes = await fetch(resultUrl);
                    if (!imgRes.ok) throw new Error(`Failed to download image from ${resultUrl}`);
                    const arrayBuffer = await imgRes.arrayBuffer();
                    imageBuffer = Buffer.from(arrayBuffer);
                } else {
                    if (externalId) imageBuffer = Buffer.alloc(0);
                    else throw new Error(`Model ${model} responded OK but no data found`);
                }

                return { imageBuffer, externalId: externalId ? String(externalId) : undefined };

            } catch (e: any) {
                if (e instanceof SuspendJobError) throw e;
                throw e;
            }
        };

        // Execute primary
        try {
            return await executeCall(finalUrl, headers, payload, cfg.providerId, cfg.modelId);
        } catch (e: any) {
            if (e instanceof SuspendJobError && cfg.providerId === 'google_gemini') {
                log({ tag: 'ai-fallback-trigger', reason: e.message, provider: 'minimax' });
                // Simple hardcoded fallback for keyframes to MiniMax if Gemini is out
                // In production this should be configured in DB
                const fallbackCfg = await loadModelConfig('image-01').catch(() => null);
                if (fallbackCfg) {
                    const fbApiKey = process.env[fallbackCfg.apiKeyEnvVarName];
                    if (fbApiKey) {
                        const fbUrl = 'https://api.minimax.io/v1/image_generation';
                        const fbHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${fbApiKey}` };
                        const fbPayload = { model: 'image-01', prompt, aspect_ratio: aspectRatio };
                        return await executeCall(fbUrl, fbHeaders, fbPayload, 'minimax', 'image-01');
                    }
                }
            }
            throw e;
        }
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

        const status: AnimationJobStatus = 'pending';

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
