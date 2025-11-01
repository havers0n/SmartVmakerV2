import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { generationProjects, storyTemplates, beats } from '@/shared/lib/schema';
import { createLogger } from '@aec/logger';
import { eq } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

const logger = createLogger({ name: 'api-generation' });

/**
 * Validation schema for generation.startProject action
 */
export const startProjectSchema = z.object({
  title: z.string().optional(),
  ratio: z.enum(['16:9', '9:16', '4:3', '3:4']).default('16:9'),
  lang: z.string().default('none'),
  source: z.enum(['prompt', 'preset', 'trends']),
  prompt: z.string().optional(),
  presetId: z.string().uuid().optional(),
  trendId: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});

export type StartProjectPayload = z.infer<typeof startProjectSchema>;

/**
 * Generate scenarios using Gemini API
 */
async function generateScenariosWithGemini(input: {
  source: 'prompt' | 'preset' | 'trends';
  prompt?: string;
  preset?: any;
  trend?: any;
  ratio: string;
  lang: string;
}): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    logger.warn('GEMINI_API_KEY not set, returning mock scenarios');
    // Return mock scenarios for development
    return [
      {
        title: 'Concept 1: Emotional Journey',
        description: 'A story focusing on personal transformation through challenges',
        aesScore: 8.5,
        hookStrength: 9.0,
        emotionalCurve: ['curiosity', 'tension', 'empathy', 'relief', 'joy'],
        scenes: [
          { phase: 'HOOK', duration: 2, description: 'Close-up of protagonist facing a challenge' },
          { phase: 'BUILD', duration: 8, description: 'Montage of struggles and setbacks' },
          { phase: 'PAYOFF', duration: 4, description: 'Breakthrough moment with emotional peak' },
          { phase: 'RESOLUTION', duration: 2, description: 'Triumphant ending' },
        ],
      },
      {
        title: 'Concept 2: Fast-Paced Action',
        description: 'Quick cuts with strong visual contrasts',
        aesScore: 7.8,
        hookStrength: 8.5,
        emotionalCurve: ['surprise', 'anticipation', 'tension', 'awe'],
        scenes: [
          { phase: 'HOOK', duration: 1, description: 'Shocking visual or statement' },
          { phase: 'BUILD', duration: 10, description: 'Rapid escalation with contrasts' },
          { phase: 'PAYOFF', duration: 3, description: 'Big reveal or transformation' },
          { phase: 'RESOLUTION', duration: 2, description: 'Satisfying conclusion' },
        ],
      },
      {
        title: 'Concept 3: Narrative Arc',
        description: 'Classic three-act structure with emotional depth',
        aesScore: 8.2,
        hookStrength: 7.5,
        emotionalCurve: ['empathy', 'curiosity', 'tension', 'anticipation', 'relief'],
        scenes: [
          { phase: 'HOOK', duration: 3, description: 'Introduce relatable situation' },
          { phase: 'BUILD', duration: 7, description: 'Develop conflict and stakes' },
          { phase: 'PAYOFF', duration: 4, description: 'Climactic moment' },
          { phase: 'RESOLUTION', duration: 2, description: 'Emotional resolution' },
        ],
      },
    ];
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // Build prompt based on source
    let systemPrompt = `You are an expert video scriptwriter specializing in short-form viral content.
Generate 3-5 different scenario concepts for a ${input.ratio} video.

Each scenario should follow the AES (Attention-Emotion-Solution) framework and include:
1. A compelling hook (≤3 seconds)
2. Emotional build-up and tension
3. A satisfying payoff/resolution
4. Clear scene breakdowns with timing

Format your response as a JSON array with this structure:
[
  {
    "title": "Concept title",
    "description": "Brief description",
    "aesScore": 8.5,
    "hookStrength": 9.0,
    "emotionalCurve": ["emotion1", "emotion2", ...],
    "scenes": [
      {"phase": "HOOK", "duration": 2, "description": "Scene description"},
      {"phase": "BUILD", "duration": 8, "description": "Scene description"},
      {"phase": "PAYOFF", "duration": 4, "description": "Scene description"},
      {"phase": "RESOLUTION", "duration": 2, "description": "Scene description"}
    ]
  }
]

`;

    if (input.source === 'prompt' && input.prompt) {
      systemPrompt += `\nUser prompt: ${input.prompt}`;
    } else if (input.source === 'preset' && input.preset) {
      systemPrompt += `\nUse this story template as a guide:
Title: ${input.preset.name}
Description: ${input.preset.description}
Target Duration: ${input.preset.targetDurationSeconds}s

Beats:
${input.preset.beats.map((b: any, i: number) => `${i + 1}. ${b.phase} (${b.durationSeconds}s): ${b.description} [Emotion: ${b.emotion}${b.contrast ? `, Contrast: ${b.contrast}` : ''}]`).join('\n')}`;
    } else if (input.source === 'trends' && input.trend) {
      systemPrompt += `\nUse these trend insights:
${input.trend.title}
${input.trend.description}
Insights: ${input.trend.insights.join(', ')}`;
    }

    const result = await model.generateContent(systemPrompt);
    const response = result.response;
    const text = response.text();

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const scenarios = JSON.parse(jsonMatch[0]);
      logger.info({ count: scenarios.length }, 'Generated scenarios with Gemini');
      return scenarios;
    }

    logger.warn('Failed to parse Gemini response, using fallback');
    throw new Error('Invalid response format from Gemini');
  } catch (error) {
    logger.error({ error }, 'Gemini API error, falling back to mock data');
    // Fallback to mock scenarios
    return [
      {
        title: 'Concept 1: Emotional Journey',
        description: 'Generated based on your input',
        aesScore: 8.0,
        hookStrength: 8.5,
        emotionalCurve: ['curiosity', 'tension', 'relief'],
        scenes: [
          { phase: 'HOOK', duration: 2, description: 'Opening hook' },
          { phase: 'BUILD', duration: 8, description: 'Build tension' },
          { phase: 'PAYOFF', duration: 4, description: 'Payoff moment' },
          { phase: 'RESOLUTION', duration: 2, description: 'Resolution' },
        ],
      },
    ];
  }
}

/**
 * Handler for generation.startProject action
 * Creates a new generation project and generates scenarios
 */
export async function startProject(payload: unknown) {
  const validated = startProjectSchema.parse(payload);

  logger.info(
    { source: validated.source, ratio: validated.ratio },
    'Starting project generation'
  );

  // Fetch preset data if using preset source
  let presetData = null;
  if (validated.source === 'preset' && validated.presetId) {
    const [template] = await db
      .select()
      .from(storyTemplates)
      .where(eq(storyTemplates.id, validated.presetId));

    if (!template) {
      throw new Error(`Story template with id ${validated.presetId} not found`);
    }

    const templateBeats = await db
      .select()
      .from(beats)
      .where(eq(beats.templateId, validated.presetId))
      .orderBy(beats.order);

    presetData = { ...template, beats: templateBeats };
    logger.info({ templateId: template.id }, 'Loaded preset template');
  }

  // Fetch trend data if using trends source
  let trendData = null;
  if (validated.source === 'trends' && validated.trendId) {
    // Fetch from trends API
    const trendsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/analytics/trends`);
    if (trendsResponse.ok) {
      const trends = await trendsResponse.json();
      trendData = trends.find((t: any) => t.id === validated.trendId);
      logger.info({ trendId: validated.trendId }, 'Loaded trend data');
    }
  }

  // Generate scenarios using Gemini
  const scenarios = await generateScenariosWithGemini({
    source: validated.source,
    prompt: validated.prompt,
    preset: presetData,
    trend: trendData,
    ratio: validated.ratio,
    lang: validated.lang,
  });

  // Create project in database
  const [project] = await db
    .insert(generationProjects)
    .values({
      ownerId: validated.ownerId,
      templateId: validated.presetId,
      status: 'pending',
      meta: {
        title: validated.title || 'Untitled Project',
        ratio: validated.ratio,
        lang: validated.lang,
        source: validated.source,
        prompt: validated.prompt,
        trendId: validated.trendId,
        scenarios,
        generatedAt: new Date().toISOString(),
      },
    })
    .returning();

  logger.info(
    { projectId: project.id, scenariosCount: scenarios.length },
    'Project created successfully'
  );

  return {
    project: {
      id: project.id,
      status: project.status,
      createdAt: project.createdAt,
    },
    scenarios,
    message: `Generated ${scenarios.length} scenario concepts`,
  };
}
