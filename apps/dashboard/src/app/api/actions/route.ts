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

/**
 * Action Registry
 * Maps action names to their handler functions
 */
const actionRegistry = {
  'ingest.startSearch': startSearch,
  'analysis.startAnalysis': startAnalysis,
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
