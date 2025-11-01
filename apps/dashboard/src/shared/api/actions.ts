/**
 * API клиент для вызова Actions
 * Универсальная функция для взаимодействия с Action Runner
 */

export interface ActionResponse<T = unknown> {
  success: boolean;
  action: string;
  result?: T;
  error?: string;
  details?: unknown;
}

export interface ActionError {
  error: string;
  details?: unknown;
}

/**
 * Универсальная функция для вызова Actions через Action Runner
 * 
 * @param action - Название действия (например, 'ingest.startSearch')
 * @param payload - Данные для обработчика
 * @returns Promise с результатом действия или ошибкой
 */
export async function callAction<T = unknown>(
  action: string, 
  payload: unknown
): Promise<T> {
  try {
    const response = await fetch('/api/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        payload,
      }),
    });

    const data: ActionResponse<T> = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Action failed');
    }

    if (data.result === undefined) {
      throw new Error('No result returned from action');
    }

    return data.result;
  } catch (error) {
    // Перебрасываем ошибку с дополнительным контекстом
    if (error instanceof Error) {
      throw new Error(`Action ${action} failed: ${error.message}`);
    }
    throw new Error(`Action ${action} failed: Unknown error`);
  }
}

/**
 * Специализированная функция для ingest.startSearch
 *
 * @param payload - Параметры поиска YouTube (query + опциональные фильтры)
 * @returns Promise с результатом создания задачи
 */
export async function startIngestSearch(payload: unknown) {
  return callAction<{ message: string; jobId: string }>('ingest.startSearch', payload);
}

// =============================================================================
// Story Templates Actions
// =============================================================================

export async function createStoryTemplate(payload: unknown) {
  return callAction('storyTemplates.create', payload);
}

export async function listStoryTemplates() {
  return callAction('storyTemplates.list', {});
}

export async function getStoryTemplateById(id: string) {
  return callAction('storyTemplates.getById', { id });
}

export async function updateStoryTemplate(id: string, payload: unknown) {
  return callAction('storyTemplates.update', { id, ...payload });
}

export async function deleteStoryTemplate(id: string) {
  return callAction('storyTemplates.delete', { id });
}

// =============================================================================
// Characters Actions
// =============================================================================

export async function createCharacter(payload: unknown) {
  return callAction('characters.create', payload);
}

export async function listCharacters() {
  return callAction('characters.list', {});
}

export async function getCharacterById(id: string) {
  return callAction('characters.getById', { id });
}

export async function updateCharacter(id: string, payload: unknown) {
  return callAction('characters.update', { id, ...payload });
}

export async function deleteCharacter(id: string) {
  return callAction('characters.delete', { id });
}
