import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { generationProjects, storyTemplates, beats, characters, assets, keyframeJobQueue, animationJobQueue, aiModels } from '@/shared/lib/schema';
import { createLogger } from '@aec/logger';
import { eq, and } from 'drizzle-orm';
import { createTextClient, generateScenariosWithTools } from '@scrimspec/halu-client';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { createProjectWithSnapshot, startProjectSchema, type StartProjectPayload } from '@/server/project-creation';
import { getTrends } from '@/shared/trends';
import {
  FeatureNotAvailableError,
  isExplicitDevelopmentMockGeneration,
} from '@/server/generation-availability';

const logger = createLogger({ name: 'api-generation' });

/**
 * Validation schema for generation.startProject action
 */
export { startProjectSchema, type StartProjectPayload } from '@/server/project-creation';

/**
 * Tool executors for MiniMax-M2 Function Calling
 */
async function executeGetStoryPresetDetails(presetId: string) {
  try {
    const [template] = await db
      .select()
      .from(storyTemplates)
      .where(eq(storyTemplates.id, presetId));

    if (!template) {
      return { error: `Story template with id ${presetId} not found` };
    }

    const templateBeats = await db
      .select()
      .from(beats)
      .where(eq(beats.templateId, presetId))
      .orderBy(beats.order);

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      tags: template.tags,
      targetDurationSeconds: template.targetDurationSeconds,
      beats: templateBeats.map(b => ({
        order: b.order,
        phase: b.phase,
        duration: b.durationSeconds,
        description: b.description,
        emotion: b.emotion,
        contrast: b.contrast,
      })),
    };
  } catch (error) {
    logger.error({ error, presetId }, 'Failed to fetch story preset');
    return { error: 'Failed to fetch story preset details' };
  }
}

async function executeGetCharacterDetails(characterId: string) {
  try {
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId));

    if (!character) {
      return { error: `Character with id ${characterId} not found` };
    }

    return {
      id: character.id,
      name: character.name,
      description: character.description,
      stylePresets: character.stylePresets,
      referenceImageUrls: character.referenceImageUrls,
    };
  } catch (error) {
    logger.error({ error, characterId }, 'Failed to fetch character');
    return { error: 'Failed to fetch character details' };
  }
}

/**
 * Generate scenarios using MiniMax-M2 with Function Calling
 */
async function generateScenariosWithMiniMax(input: {
  source: StartProjectPayload['source'];
  prompt: string;
  contentFormat?: any;
  storyTemplate?: any;
  ratio: string;
  lang: string;
}): Promise<any[]> {
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    if (!isExplicitDevelopmentMockGeneration()) {
      throw new FeatureNotAvailableError('MiniMax scenario generation is not configured');
    }
    logger.warn('MINIMAX_API_KEY not set; using explicitly enabled development mock scenarios');
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
    // Create MiniMax-M2 text client
    const client = createTextClient({ apiKey });

    // Define tools for Function Calling
    const tools: ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'get_story_preset_details',
          description: 'Get detailed information about a story template/preset from the library, including its beats, emotions, and timing structure',
          parameters: {
            type: 'object',
            properties: {
              presetId: {
                type: 'string',
                description: 'UUID of the story template to fetch',
              },
            },
            required: ['presetId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_character_details',
          description: 'Get detailed information about a character from the library, including visual description, style presets, and reference images',
          parameters: {
            type: 'object',
            properties: {
              characterId: {
                type: 'string',
                description: 'UUID of the character to fetch',
              },
            },
            required: ['characterId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'generate_video_scenarios',
          description: 'Generate structured video scenarios with scenes, emotions, and AES (Attention-Emotion-Solution) scoring',
          parameters: {
            type: 'object',
            properties: {
              scenarios: {
                type: 'array',
                description: 'Array of scenario objects',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Scenario title' },
                    description: { type: 'string', description: 'Brief scenario description' },
                    aesScore: { type: 'number', description: 'AES score (0-100)' },
                    hookStrength: { type: 'number', description: 'Hook strength (0-100)' },
                    emotionalCurve: {
                      type: 'array',
                      description: 'Emotional progression',
                      items: { type: 'string' },
                    },
                    scenes: {
                      type: 'array',
                      description: 'Array of scenes',
                      items: {
                        type: 'object',
                        properties: {
                          phase: { type: 'string', description: 'Scene phase: HOOK, BUILD, PAYOFF, or RESOLUTION' },
                          duration: { type: 'number', description: 'Scene duration in seconds' },
                          description: { type: 'string', description: 'Visual description of the scene' },
                          cameraCommands: { 
                            type: 'array', 
                            description: 'Suggested camera movements for this scene (e.g., [Push in, Pan right])',
                            items: { type: 'string' }
                          },
                        },
                        required: ['phase', 'duration', 'description'],
                      },
                    },
                  },
                  required: ['title', 'description', 'aesScore', 'hookStrength', 'emotionalCurve', 'scenes'],
                },
              },
            },
            required: ['scenarios'],
          },
        },
      },
    ];

    // Build user prompt based on source
    let userPrompt = `Create 3-5 video scenario concepts for a ${input.ratio} video`;

    if (input.lang && input.lang !== 'none') {
      userPrompt += ` in ${input.lang} language`;
    }

    userPrompt += `.

Each scenario MUST follow the AES (Attention-Emotion-Solution) framework:
1. HOOK phase (≤3 seconds): Grab attention immediately
2. BUILD phase: Create emotional tension and engagement
3. PAYOFF phase: Deliver the climax or key revelation
4. RESOLUTION phase: Provide satisfying closure

Requirements:
- Total duration should be 15-20 seconds per scenario
- Each scene must have specific visual descriptions
- AES scores should reflect viral potential (0-100)
- Hook strength should reflect immediate engagement (0-100)
- Emotional curve should show progression through the video
- Include suggested camera movements for each scene (e.g., [Push in, Pan right])

`;

    if (input.source === 'prompt') {
      userPrompt += `\nUser's creative brief:\n${input.prompt}\n`;
    } else if ((input.source === 'story_template' || input.source === 'preset') && input.storyTemplate) {
      userPrompt += `\nBase your scenarios on this story template:
Title: ${input.storyTemplate.templateName}
Target Duration: ${input.storyTemplate.targetDurationSeconds}s

Story Beats:
${input.storyTemplate.beats.map((b: any, i: number) => `${i + 1}. ${b.phase} (${b.durationSeconds}s): ${b.description} [Emotion: ${b.emotion}${b.contrast ? `, Contrast: ${b.contrast}` : ''}]`).join('\n')}
`;
    } else if (input.source === 'content_format') {
      userPrompt += `\nProject idea:\n${input.prompt}\n\nContent format constraints:\nDescription: ${input.contentFormat?.description ?? ''}\nHook: ${input.contentFormat?.hookPattern ?? ''}\nStructure: ${input.contentFormat?.structurePattern ?? ''}\nVisual: ${input.contentFormat?.visualPattern ?? ''}\nPacing: ${input.contentFormat?.pacingPattern ?? ''}\nDuration range: ${input.contentFormat?.durationMinSeconds ?? 'unspecified'}-${input.contentFormat?.durationMaxSeconds ?? 'unspecified'} seconds\n`;
      if (input.storyTemplate) userPrompt += `\nStory template beats (metadata; do not override the content-format duration range):\n${input.storyTemplate.beats.map((b: any) => `${b.phase} (${b.durationSeconds}s): ${b.description}`).join('\n')}\n`;
    } else if (input.source === 'trends') {
      userPrompt += `\nCreate scenarios based on legacy trends context.\n`;
    }

    userPrompt += `\nIMPORTANT: Call the generate_video_scenarios function with your complete scenario concepts.`;

    const systemMessage = `You are an expert video scriptwriter and creative strategist specializing in viral short-form content.

Your expertise includes:
- AES (Attention-Emotion-Solution) framework for viral content
- Emotional storytelling and pacing
- Visual scene composition
- Viral video patterns and hooks

You have access to tools to fetch additional context from the content library if needed (story presets, character details).

When generating scenarios, ensure each one is:
- Visually compelling and specific
- Emotionally engaging with clear progression
- Optimized for the requested aspect ratio
- Structured with proper timing and pacing
- Include suggested camera movements for dynamic visual storytelling (e.g., [Push in, Pan right, Tilt up])
`;

    // First API call - MiniMax-M2 decides what to do
    logger.info({ source: input.source }, 'Calling MiniMax-M2 for scenario generation');

    const response = await generateScenariosWithTools(
      client,
      userPrompt,
      tools,
      {
        systemMessage,
        maxTokens: 4096,
        temperature: 0.85,
        toolChoice: 'auto',
      }
    );

    // Check if model wants to call any tools first
    if (response.toolCalls && response.toolCalls.length > 0) {
      logger.info({ toolCalls: response.toolCalls.length }, 'MiniMax-M2 requested tool calls');

      // Execute tool calls
      const toolResults: Array<{ toolCallId: string; result: any }> = [];

      for (const toolCall of response.toolCalls) {
        if (toolCall.function.name === 'get_story_preset_details') {
          const args = toolCall.function.argumentsParsed as { presetId: string };
          const result = await executeGetStoryPresetDetails(args.presetId);
          toolResults.push({ toolCallId: toolCall.id, result });
          logger.info({ presetId: args.presetId }, 'Fetched story preset details');
        } else if (toolCall.function.name === 'get_character_details') {
          const args = toolCall.function.argumentsParsed as { characterId: string };
          const result = await executeGetCharacterDetails(args.characterId);
          toolResults.push({ toolCallId: toolCall.id, result });
          logger.info({ characterId: args.characterId }, 'Fetched character details');
        } else if (toolCall.function.name === 'generate_video_scenarios') {
          const args = toolCall.function.argumentsParsed as { scenarios: any[] };
          logger.info({ count: args.scenarios.length }, 'MiniMax-M2 generated scenarios');
          return args.scenarios;
        }
      }

      // If there were tool calls but not the final generation, make a second call with tool results
      if (toolResults.length > 0) {
        const followUpPrompt = `Based on the additional context from the library, now generate the final video scenarios using the generate_video_scenarios function.

Tool results:
${toolResults.map(tr => JSON.stringify(tr.result, null, 2)).join('\n\n')}`;

        const finalResponse = await generateScenariosWithTools(
          client,
          followUpPrompt,
          tools,
          {
            systemMessage,
            maxTokens: 4096,
            temperature: 0.85,
            toolChoice: { type: 'function', function: { name: 'generate_video_scenarios' } },
          }
        );

        if (finalResponse.toolCalls) {
          const generateCall = finalResponse.toolCalls.find(tc => tc.function.name === 'generate_video_scenarios');
          if (generateCall && generateCall.function.argumentsParsed) {
            const args = generateCall.function.argumentsParsed as { scenarios: any[] };
            logger.info({ count: args.scenarios.length }, 'Generated scenarios with MiniMax-M2 after tool enrichment');
            return args.scenarios;
          }
        }
      }
    }

    // If we got here, something went wrong
    logger.warn('MiniMax-M2 did not generate scenarios as expected, using fallback');
    throw new Error('No scenarios generated by MiniMax-M2');

  } catch (error) {
    if (!isExplicitDevelopmentMockGeneration()) {
      throw new FeatureNotAvailableError('MiniMax scenario generation failed');
    }
    logger.error({ error }, 'MiniMax-M2 API error; using explicitly enabled development mock data');
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
export async function startProject(
  payload: unknown,
  ctx?: { userId?: string }
) {
  const userId = ctx?.userId;
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const validated = startProjectSchema.parse(payload);

  // Legacy wizard compatibility: preserve its existing trend lookup semantics.
  if (validated.source === 'trends' && !getTrends().some((trend) => trend.id === validated.trendId)) {
    throw new z.ZodError([{ code: 'custom', path: ['trendId'], message: `Trend not found: ${validated.trendId}` }]);
  }

  logger.info(
    { source: validated.source, ratio: validated.ratio },
    'Starting project generation'
  );

  // Resolve AI models - use provided IDs or fetch defaults
  let textModelId = validated.textModelId;
  let imageModelId = validated.imageModelId;

  if (!textModelId) {
    logger.info('textModelId not provided, fetching default text-to-text model');
    const [defaultTextModel] = await db
      .select()
      .from(aiModels)
      .where(
        and(
          eq(aiModels.type, 'text-to-text'),
          eq(aiModels.isDefault, true),
          eq(aiModels.isEnabled, true)
        )
      )
      .limit(1);

    if (defaultTextModel) {
      textModelId = defaultTextModel.id;
      logger.info({ modelId: textModelId }, 'Using default text-to-text model');
    } else {
      logger.warn('No default text-to-text model found');
    }
  }

  if (!imageModelId) {
    logger.info('imageModelId not provided, fetching default text-to-image model');
    const [defaultImageModel] = await db
      .select()
      .from(aiModels)
      .where(
        and(
          eq(aiModels.type, 'text-to-image'),
          eq(aiModels.isDefault, true),
          eq(aiModels.isEnabled, true)
        )
      )
      .limit(1);

    if (defaultImageModel) {
      imageModelId = defaultImageModel.id;
      logger.info({ modelId: imageModelId }, 'Using default text-to-image model');
    } else {
      logger.warn('No default text-to-image model found');
    }
  }

  // Context loading, generation, and persistence share one transaction: the exact
  // snapshot supplied to the model is the snapshot stored on the project.
  const created = await createProjectWithSnapshot({
    input: validated, userId, textModelId, imageModelId,
    generateScenarios: (context) => generateScenariosWithMiniMax({
      source: validated.source, prompt: validated.prompt ?? (validated.source === 'trends' ? getTrends().find((trend) => trend.id === validated.trendId)?.title ?? validated.trendId : ''), contentFormat: context.contentFormat,
      storyTemplate: context.storyTemplate, ratio: validated.ratio, lang: validated.lang,
    }),
  });
  const { project, scenarios } = created;

  logger.info(
    {
      projectId: project.id,
      scenariosCount: scenarios.length,
      textModelId,
      imageModelId,
    },
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

/**
 * Validation schema for generation.generateKeyframes action
 */
export const generateKeyframesSchema = z.object({
  projectId: z.string().uuid(),
  selectedScenarioIndex: z.number().int().min(0),
});

export type GenerateKeyframesPayload = z.infer<typeof generateKeyframesSchema>;

const KEYFRAME_IMAGE_STYLE = 'Ultra realistic, cinematic still frame, 8k, shallow depth of field, natural lighting.';
const KEYFRAME_NEGATIVE_TEXT = 'no text, no captions, no subtitles, no watermarks, no titles, no interface elements, no logos, no numbers on the image, no graphic overlays';

function buildVisualPrompt(raw?: string): string {
  if (!raw) return '';

  let cleaned = raw
    // Убираем служебные лейблы сцен/кадров
    .replace(/^scene\s*\d+(?:\/\d+)?\s*[:\-]\s*/i, '')
    .replace(/\bframe\s*\d+(?:\/\d+)?\s*[:\-]?\s*/gi, '')
    .replace(/\b(opening|closing|final)\s*frame\s*[:\-]?\s*/gi, '')
    .replace(/\bphase\s*[:\-]\s*\w+\b/gi, '')
    // Убираем явные указания текста на экране
    .replace(/text on screen:[^.]+/gi, '')
    .trim();

  // Если после чистки всё убрали — возвращаем исходное, чтобы не потерять смысл
  if (!cleaned) {
    cleaned = raw.trim();
  }

  return cleaned;
}

/**
 * Handler for generation.generateKeyframes action
 * Creates keyframe generation jobs for first and last frame of each scene
 */
export async function generateKeyframes(
  payload: unknown,
  ctx?: { userId?: string }
) {
  const userId = ctx?.userId;
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const validated = generateKeyframesSchema.parse(payload);

  logger.info(
    { projectId: validated.projectId, scenarioIndex: validated.selectedScenarioIndex },
    'Starting keyframe generation'
  );

  // Load project from database
  const [project] = await db
    .select()
    .from(generationProjects)
    .where(and(eq(generationProjects.id, validated.projectId), eq(generationProjects.ownerId, userId)));

  if (!project) {
    throw new Error(`Project with id ${validated.projectId} not found`);
  }

  // Extract scenarios from project meta
  const meta = project.meta as any;
  const scenarios = meta.scenarios || [];

  if (!scenarios[validated.selectedScenarioIndex]) {
    throw new Error(`Scenario at index ${validated.selectedScenarioIndex} not found`);
  }

  const selectedScenario = scenarios[validated.selectedScenarioIndex];
  const scenes = selectedScenario.scenes || [];

  if (scenes.length === 0) {
    throw new Error('Selected scenario has no scenes');
  }

  logger.info({ scenesCount: scenes.length }, 'Processing scenes for keyframe generation');

  // Get aspect ratio from project meta for image generation
  const aspectRatio = meta.ratio || '16:9';

  // Map aspect ratio to Gemini's format
  const geminiAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';

  // Get project characters if available
  const characters = meta.characters || [];

  // Get image model ID from project meta
  const imageModelId = meta.imageModelId;

  const jobsCreated: string[] = [];

  // Process each scene
  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
    const scene = scenes[sceneIndex];

    const sceneDescription = scene.description || '';
    const visualPrompt = buildVisualPrompt(scene.visualPrompt || sceneDescription);

    if (!visualPrompt) {
      throw new Error(`Scene ${sceneIndex} has empty visual description`);
    }

    const charactersLine =
      characters.length > 0 ? ` featuring ${characters.map((c: any) => c.name).join(', ')}` : '';

    const baseVisual = `${visualPrompt}${charactersLine}`.trim();
    const positivePrompt = `${baseVisual}. ${KEYFRAME_IMAGE_STYLE}`;
    const fullPrompt = `${positivePrompt} Avoid any written text or titles on the image. Negative prompt: ${KEYFRAME_NEGATIVE_TEXT}.`;

    const firstFramePrompt = `${fullPrompt} Opening moment, initial state.`;
    const lastFramePrompt = `${fullPrompt} Closing moment, final state or result.`;

    // Create asset records for both keyframes
    const [firstAsset] = await db
      .insert(assets)
      .values({
        generationProjectId: validated.projectId,
        assetType: 'keyframe',
        status: 'pending',
        storageUrl: '', // Will be updated by worker
        meta: {
          sceneIndex,
          frameType: 'first',
          phase: scene.phase,
          duration: scene.duration,
          aspectRatio: geminiAspectRatio,
          visualPrompt,
        },
      } as any)
      .returning();

    const [lastAsset] = await db
      .insert(assets)
      .values({
        generationProjectId: validated.projectId,
        assetType: 'keyframe',
        status: 'pending',
        storageUrl: '', // Will be updated by worker
        meta: {
          sceneIndex,
          frameType: 'last',
          phase: scene.phase,
          duration: scene.duration,
          aspectRatio: geminiAspectRatio,
          visualPrompt,
        },
      } as any)
      .returning();

    // Create job queue entries for both keyframes
    const [firstJob] = await db
      .insert(keyframeJobQueue)
      .values({
        projectId: validated.projectId,
        sceneIndex,
        frameType: 'first',
        prompt: firstFramePrompt,
        assetId: firstAsset.id,
        modelId: imageModelId, // Add model ID to job
        status: 'pending',
      } as any)
      .returning();

    const [lastJob] = await db
      .insert(keyframeJobQueue)
      .values({
        projectId: validated.projectId,
        sceneIndex,
        frameType: 'last',
        prompt: lastFramePrompt,
        assetId: lastAsset.id,
        modelId: imageModelId, // Add model ID to job
        status: 'pending',
      } as any)
      .returning();

    jobsCreated.push(firstJob.id, lastJob.id);

    logger.info(
      { sceneIndex, firstAssetId: firstAsset.id, lastAssetId: lastAsset.id, imageModelId },
      'Created keyframe jobs for scene'
    );
  }

  // Update project status to generating_keyframes
  await db
    .update(generationProjects)
    .set({
      status: 'processing' as any, // We'll update the enum later
      meta: {
        ...meta,
        selectedScenarioIndex: validated.selectedScenarioIndex,
        keyframeGenerationStartedAt: new Date().toISOString(),
      },
      updatedAt: new Date() as any,
    })
    .where(eq(generationProjects.id, validated.projectId));

  logger.info(
    { projectId: validated.projectId, jobsCreated: jobsCreated.length },
    'Keyframe generation jobs created successfully'
  );

  return {
    projectId: validated.projectId,
    scenesProcessed: scenes.length,
    jobsCreated: jobsCreated.length,
    message: `Created ${jobsCreated.length} keyframe generation jobs for ${scenes.length} scenes`,
  };
}

/**
 * Validation schema for generation.startAnimation action
 */
export const startAnimationSchema = z.object({
  projectId: z.string().uuid(),
});

export type StartAnimationPayload = z.infer<typeof startAnimationSchema>;

/**
 * Handler for generation.startAnimation action
 * Creates animation generation jobs for each scene's keyframe pair
 */
export async function startAnimation(
  payload: unknown,
  ctx?: { userId?: string }
) {
  const userId = ctx?.userId;
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const validated = startAnimationSchema.parse(payload);

  logger.info(
    { projectId: validated.projectId },
    'Starting animation generation'
  );

  // Load project from database
  const [project] = await db
    .select()
    .from(generationProjects)
    .where(and(eq(generationProjects.id, validated.projectId), eq(generationProjects.ownerId, userId)));

  if (!project) {
    throw new Error(`Project with id ${validated.projectId} not found`);
  }

  // Get project metadata
  const meta = project.meta as any;
  const selectedScenarioIndex = meta.selectedScenarioIndex;

  if (selectedScenarioIndex === undefined) {
    throw new Error('No scenario has been selected for this project');
  }

  const scenarios = meta.scenarios || [];
  const selectedScenario = scenarios[selectedScenarioIndex];

  if (!selectedScenario) {
    throw new Error(`Scenario at index ${selectedScenarioIndex} not found`);
  }

  const scenes = selectedScenario.scenes || [];

  if (scenes.length === 0) {
    throw new Error('Selected scenario has no scenes');
  }

  logger.info({ scenesCount: scenes.length }, 'Processing scenes for animation generation');

  // Get all assets for this project grouped by scene
  const projectAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.generationProjectId, validated.projectId));

  // Group assets by scene index and frame type
  const assetsByScene = new Map<number, { first: any; last: any }>();

  for (const asset of projectAssets) {
    const assetMeta = asset.meta as any;
    const sceneIndex = assetMeta?.sceneIndex;
    const frameType = assetMeta?.frameType;

    if (sceneIndex === undefined || !frameType) {
      continue;
    }

    if (!assetsByScene.has(sceneIndex)) {
      assetsByScene.set(sceneIndex, { first: null, last: null });
    }

    const sceneAssets = assetsByScene.get(sceneIndex)!;
    if (frameType === 'first') {
      sceneAssets.first = asset;
    } else if (frameType === 'last') {
      sceneAssets.last = asset;
    }
  }

  // Verify all scenes have both keyframes completed
  const missingKeyframes: number[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const sceneAssets = assetsByScene.get(i);
    if (!sceneAssets?.first || !sceneAssets?.last) {
      missingKeyframes.push(i);
      continue;
    }

    if (sceneAssets.first.status !== 'completed' || sceneAssets.last.status !== 'completed') {
      missingKeyframes.push(i);
    }
  }

  if (missingKeyframes.length > 0) {
    throw new Error(
      `Cannot start animation: keyframes not ready for scenes: ${missingKeyframes.join(', ')}`
    );
  }

  // Create animation job queue entries for each scene
  const jobsCreated: string[] = [];

  for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
    const sceneAssets = assetsByScene.get(sceneIndex)!;
    const scene = scenes[sceneIndex];
    
    // Build scene description including camera commands if available
    let sceneDescription = scene.description || '';
    
    // Add camera commands if available
    if (scene.cameraCommands && Array.isArray(scene.cameraCommands) && scene.cameraCommands.length > 0) {
      sceneDescription += ` [${scene.cameraCommands.join(',')}]`;
    }

    const [job] = await db
      .insert(animationJobQueue)
      .values({
        projectId: validated.projectId,
        sceneIndex,
        assetIdFirstFrame: sceneAssets.first.id,
        assetIdLastFrame: sceneAssets.last.id,
        sceneDescription, // Add scene description to job
        status: 'pending',
      } as any)
      .onConflictDoNothing({
        target: [animationJobQueue.projectId, animationJobQueue.sceneIndex],
      })
      .returning();

    if (!job) {
      logger.warn({ projectId: validated.projectId, sceneIndex }, 'Animation job already exists, skipping duplicate');
      continue;
    }

    jobsCreated.push(job.id);

    logger.info(
      {
        sceneIndex,
        jobId: job.id,
        firstFrameAssetId: sceneAssets.first.id,
        lastFrameAssetId: sceneAssets.last.id,
        sceneDescription,
      },
      'Created animation job for scene'
    );
  }

  // Update project status to animating
  await db
    .update(generationProjects)
    .set({
      status: 'processing' as any,
      meta: {
        ...meta,
        animationStartedAt: new Date().toISOString(),
      },
      updatedAt: new Date() as any,
    })
    .where(eq(generationProjects.id, validated.projectId));

  logger.info(
    { projectId: validated.projectId, jobsCreated: jobsCreated.length },
    'Animation jobs created successfully'
  );

  return {
    projectId: validated.projectId,
    scenesProcessed: scenes.length,
    jobsCreated: jobsCreated.length,
    message: `Created ${jobsCreated.length} animation jobs for ${scenes.length} scenes`,
  };
}
