// packages/hwar-core/src/ai/types.ts

export interface AnalyzeVideoInput {
    videoUrl: string;
    videoId: string; // For logging/context
    analyzerName?: string; // e.g. 'gemini-pro'
}

export interface AnalyzeVideoOutput {
    hook_text: string;
    emotion_tags: string[];
    beats: Array<{
        time_s: number;
        desc: string;
        emotion: string;
    }>;
    payoff: string;
    moral: string;
}

export interface GenerateKeyframeInput {
    prompt: string;
    negativePrompt?: string;
    aspectRatio: string;
    modelId?: string;
    projectId: string; // For logging/context
    sceneIndex: number;
}

export interface GenerateKeyframeOutput {
    imageBuffer: Buffer;
    externalId?: string;
}

export type AnimationJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface AnimationKeyframe {
    assetId?: string;
    publicUrl: string;
    frameType?: 'first' | 'last' | 'middle';
    frameIndex?: number;
}

export interface GenerateAnimationInput {
    projectId: string;
    sceneIndex: number;
    keyframes: AnimationKeyframe[];
    prompt?: string;
    modelId?: string;
    durationSec?: number;
    resolution?: '512P' | '720P' | '768P' | '1080P';
}

export interface GenerateAnimationOutput {
    provider: string;
    model: string;
    externalTaskId: string;
    status: AnimationJobStatus;
    videoUrl?: string;
    minimaxFileId?: string;
}
