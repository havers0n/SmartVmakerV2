export const runtime = 'nodejs'; // 'edge' is the default

import { NextRequest, NextResponse } from 'next/server';
import { startSearch } from './handlers/ingest';
import { startAnalysis } from './handlers/analysis';
import {
  createStoryTemplate,
  listStoryTemplates,
  getStoryTemplateById,
  updateStoryTemplate,
  deleteStoryTemplate,
} from './handlers/story-templates';
import {
  createCharacter,
  listCharacters,
  getCharacterById,
  updateCharacter,
  deleteCharacter,
} from './handlers/characters';
import { startProject, generateKeyframes, startAnimation } from './handlers/generation';
import { listProjects } from './handlers/projects';
import { listModels } from './handlers/models';

type ActionHandler = (payload: unknown) => Promise<unknown> | unknown;

const envFlag = (name: string, defaultValue: boolean) => {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value === '1' || value.toLowerCase() === 'true';
};

const featureFlags = {
  enableIngest: envFlag('HWAR_ENABLE_INGEST', false),
  enableAnalysis: envFlag('HWAR_ENABLE_ANALYSIS', true),
  // По умолчанию включаем generation/animation, т.к. это core-функционал создания видео.
  // Если нужно отключить дорогостоящие операции в конкретной среде — используйте HWAR_ENABLE_GENERATION/HWAR_ENABLE_ANIMATION.
  enableGeneration: envFlag('HWAR_ENABLE_GENERATION', true),
  enableAnimation: envFlag('HWAR_ENABLE_ANIMATION', true),
  enableKeyframes: envFlag('HWAR_ENABLE_KEYFRAMES', true),
};

const baseRegistry = {
  'storyTemplates.create': createStoryTemplate,
  'storyTemplates.list': listStoryTemplates,
  'storyTemplates.getById': getStoryTemplateById,
  'storyTemplates.update': updateStoryTemplate,
  'storyTemplates.delete': deleteStoryTemplate,
  'characters.create': createCharacter,
  'characters.list': listCharacters,
  'characters.getById': getCharacterById,
  'characters.update': updateCharacter,
  'characters.delete': deleteCharacter,
  'projects.list': listProjects,
  'models.list': listModels,
} satisfies Record<string, ActionHandler>;

const actionRegistry = {
  ...baseRegistry,
  ...(featureFlags.enableIngest ? { 'ingest.startSearch': startSearch } : {}),
  ...(featureFlags.enableAnalysis ? { 'analysis.startAnalysis': startAnalysis } : {}),
  ...(featureFlags.enableGeneration ? { 'generation.startProject': startProject } : {}),
  ...(featureFlags.enableKeyframes ? { 'generation.generateKeyframes': generateKeyframes } : {}),
  ...(featureFlags.enableAnimation ? { 'generation.startAnimation': startAnimation } : {}),
} as const;

type ActionName = keyof typeof actionRegistry;

/**
 * Action Runner
 * POST /api/actions
 *
 * Universal endpoint for executing registered actions
 *
 * Request body:
 * {
 *   action: string,    // Action name from registry (e.g., 'ingest.startSearch')
 *   payload: unknown   // Action-specific data
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   action: string,
 *   result?: unknown,  // Result from handler
 *   error?: string     // Error message if failed
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    // Validate action name
    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action: must be a non-empty string',
        },
        { status: 400 }
      );
    }

    // Find handler in registry
    const handler = actionRegistry[action as ActionName];

    if (!handler) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown action: ${action}`,
          details: {
            availableActions: Object.keys(actionRegistry),
          },
        },
        { status: 404 }
      );
    }

    // Execute handler with payload
    const result = await handler(payload);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        action,
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Action execution failed:', error);

    // Handle validation errors (from Zod)
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error,
        },
        { status: 400 }
      );
    }

    // Handle general errors
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
