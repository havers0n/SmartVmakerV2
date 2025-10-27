import { NextRequest, NextResponse } from 'next/server';
import { startSearch } from './handlers/ingest';

/**
 * Action Runner - центральный обработчик для всех действий системы
 * Маршрутизирует запросы к соответствующим обработчикам на основе action name
 */

// Реестр всех доступных действий
const actionRegistry = {
  'ingest.startSearch': startSearch,
  // ... другие экшены в будущем
} as const;

type ActionName = keyof typeof actionRegistry;

/**
 * POST /api/actions
 * Выполняет действие на основе переданного action name
 * 
 * Request body:
 * {
 *   action: string,    // Название действия (например, "ingest.startSearch")
 *   payload: any       // Данные для обработчика
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body ?? {};

    // Валидация обязательных полей
    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'action is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Проверка существования действия в реестре
    if (!(action in actionRegistry)) {
      return NextResponse.json(
        { 
          error: `Unknown action: ${action}`,
          availableActions: Object.keys(actionRegistry)
        },
        { status: 400 }
      );
    }

    // Получение и выполнение обработчика
    const handler = actionRegistry[action as ActionName];
    const result = await handler(payload);

    return NextResponse.json({
      success: true,
      action,
      result,
    });

  } catch (error) {
    console.error('Error executing action:', error);
    
    // Обработка ошибок валидации Zod
    if (error && typeof error === 'object' && 'issues' in error) {
      return NextResponse.json(
        { 
          error: 'Validation error',
          details: error
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/actions
 * Возвращает список доступных действий
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    availableActions: Object.keys(actionRegistry),
    description: 'Action Runner - центральный обработчик для всех действий системы'
  });
}
