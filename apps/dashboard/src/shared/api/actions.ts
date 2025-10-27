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
 * @param query - Поисковый запрос
 * @returns Promise с результатом создания задачи
 */
export async function startIngestSearch(query: string) {
  return callAction<{ message: string; jobId: string }>('ingest.startSearch', { query });
}
