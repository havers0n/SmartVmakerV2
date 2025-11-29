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
    aspectRatio: string;
    modelId?: string;
    projectId: string; // For logging/context
    sceneIndex: number;
}

export interface GenerateKeyframeOutput {
    imageBuffer: Buffer;
    externalId?: string;
}

export interface GenerateAnimationInput {
    prompt: string;
    firstFrameAssetId: string;
    lastFrameAssetId: string;
    modelId?: string;
    projectId: string;
}

export interface GenerateAnimationOutput {
    videoUrl?: string; // If provider returns URL
    videoBuffer?: Buffer; // If provider returns bytes
    externalId?: string;
}
