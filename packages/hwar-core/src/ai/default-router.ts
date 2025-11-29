// packages/hwar-core/src/ai/default-router.ts

import { AiRouter } from './router';
import {
    AnalyzeVideoInput,
    AnalyzeVideoOutput,
    GenerateKeyframeInput,
    GenerateKeyframeOutput,
    GenerateAnimationInput,
    GenerateAnimationOutput
} from './types';

export interface DefaultAiRouterConfig {
    geminiApiKey?: string;
    geminiModel?: string;
    minimaxApiKey?: string;
    minimaxGroupId?: string;
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

    async generateKeyframe(_input: GenerateKeyframeInput): Promise<GenerateKeyframeOutput> {
        // Placeholder for now, to be ported from keyframe-worker.ts
        throw new Error('generateKeyframe not implemented in DefaultAiRouter yet');
    }

    async generateAnimation(_input: GenerateAnimationInput): Promise<GenerateAnimationOutput> {
        // Placeholder
        throw new Error('generateAnimation not implemented in DefaultAiRouter yet');
    }
}
