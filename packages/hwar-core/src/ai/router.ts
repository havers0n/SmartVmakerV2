// packages/hwar-core/src/ai/router.ts

import {
    AnalyzeVideoInput,
    AnalyzeVideoOutput,
    GenerateKeyframeInput,
    GenerateKeyframeOutput,
    GenerateAnimationInput,
    GenerateAnimationOutput
} from './types';

export interface AiRouter {
    analyzeVideo(input: AnalyzeVideoInput): Promise<AnalyzeVideoOutput>;
    generateKeyframe(input: GenerateKeyframeInput): Promise<GenerateKeyframeOutput>;
    generateAnimation(input: GenerateAnimationInput): Promise<GenerateAnimationOutput>;
}
