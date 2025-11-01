# Action ingest.startSearch - Документация

## Описание
Action `ingest.startSearch` предназначен для создания задач поиска и ингеста YouTube видео в системе Scrimspec.

## Архитектура

### 1. Core Domain Schema (`packages/core-domain`)
- **Файл**: `packages/core-domain/src/schemas/ingest.ts`
- **Назначение**: Определяет контракт для валидации входных данных
- **Схема**: `startSearchPayloadSchema` с полем `query` (минимум 3 символа)

### 2. Action Handler (`apps/dashboard/app/api/actions/handlers/ingest.ts`)
- **Функция**: `startSearch(payload: unknown)`
- **Назначение**: Обрабатывает бизнес-логику создания задачи
- **Действия**:
  1. Валидация payload через Zod-схему
  2. Создание записи в таблице `ingest_job_queue`
  3. Возврат результата с jobId

### 3. Action Runner (`apps/dashboard/app/api/actions/route.ts`)
- **Endpoint**: `POST /api/actions`
- **Назначение**: Центральный маршрутизатор для всех действий системы
- **Реестр**: Содержит маппинг `action name -> handler function`

## Использование

### HTTP Request
```bash
POST /api/actions
Content-Type: application/json

{
  "action": "ingest.startSearch",
  "payload": {
    "query": "your search query here"
  }
}
```

### Response (Success)
```json
{
  "success": true,
  "action": "ingest.startSearch",
  "result": {
    "message": "Ingest job started successfully",
    "jobId": "uuid-generated-job-id"
  }
}
```

### Response (Error)
```json
{
  "error": "Validation error",
  "details": {
    "issues": [
      {
        "code": "too_small",
        "minimum": 3,
        "type": "string",
        "inclusive": true,
        "exact": false,
        "message": "Query must be at least 3 characters long",
        "path": ["query"]
      }
    ]
  }
}
```

## База данных

### Таблица: `ingest_job_queue`
```sql
CREATE TABLE ingest_job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  published_after TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Тестирование

### 1. Запуск dev-сервера
```bash
cd apps/dashboard
pnpm dev
```

### 2. Тест через curl
```bash
curl -X POST http://localhost:3000/api/actions \
  -H "Content-Type: application/json" \
  -d '{
    "action": "ingest.startSearch",
    "payload": {
      "query": "test search query"
    }
  }'
```

### 3. Тест через JavaScript
```javascript
const response = await fetch('http://localhost:3000/api/actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: "ingest.startSearch",
    payload: { query: "test search query" }
  })
});

const result = await response.json();
console.log(result);
```

## Расширение

### Добавление новых Actions
1. Создать схему в `packages/core-domain/src/schemas/`
2. Создать handler в `apps/dashboard/app/api/actions/handlers/`
3. Добавить в реестр `actionRegistry` в `route.ts`

### Пример добавления нового Action
```typescript
// 1. Схема
export const newActionSchema = z.object({
  param1: z.string(),
  param2: z.number().optional()
});

// 2. Handler
export async function newAction(payload: unknown) {
  const validated = newActionSchema.parse(payload);
  // ... бизнес-логика
  return { result: "success" };
}

// 3. Реестр
const actionRegistry = {
  'ingest.startSearch': startSearch,
  'new.action': newAction, // <- добавить сюда
};
```

## Безопасность
- Все входные данные валидируются через Zod-схемы
- Ошибки валидации возвращаются с детальным описанием
- SQL-инъекции предотвращены через Drizzle ORM
- Типизация TypeScript обеспечивает безопасность на этапе компиляции
