# AI Providers & Models - Документация

## Обзор

Новые таблицы `ai_providers` и `ai_models` предоставляют централизованное управление AI-провайдерами и их моделями в Scrimspec.

## Схема базы данных

### Таблица: `aes_core.ai_providers`

Хранит информацию о провайдерах AI API (Google, MiniMax, OpenAI и т.д.).

**Поля:**
- `id` (text, PK) - Уникальный идентификатор провайдера, например: `'google_gemini'`, `'minimax'`
- `name` (text) - Отображаемое имя, например: `"Google Gemini"`, `"MiniMax"`
- `api_base_url` (text, nullable) - Базовый URL API, например: `"https://api.minimax.io/v1"`
- `authentication_type` (enum auth_type) - Тип аутентификации:
  - `bearer_token` - Bearer token в заголовке Authorization
  - `api_key_header` - API key в custom header (например, X-API-Key)
  - `query_param` - API key как query parameter (например, ?key=...)
- `api_key_env_var_name` (text) - Имя переменной окружения для API ключа
- `metadata` (jsonb) - Дополнительная информация: docs_url, rate_limits, region и т.д.
- `created_at`, `updated_at` (timestamp)

**Пример:**
```typescript
{
  id: 'minimax',
  name: 'MiniMax',
  apiBaseUrl: 'https://api.minimax.io/v1',
  authenticationType: 'bearer_token',
  apiKeyEnvVarName: 'MINIMAX_API_KEY',
  metadata: {
    docs_url: 'https://www.minimaxi.com/document/guides',
    region: 'cn',
    supports_streaming: true
  }
}
```

---

### Таблица: `aes_core.ai_models`

Хранит информацию о конкретных моделях AI с привязкой к провайдерам.

**Поля:**
- `id` (text, PK) - Уникальный идентификатор модели, например: `'gemini-2.5-flash-image'`, `'minimax-m2'`
- `provider_id` (text, FK → ai_providers.id) - ID провайдера
- `name` (text) - Отображаемое имя модели
- `type` (enum model_type) - Тип модели:
  - `text-to-text` - Текстовая генерация (LLM)
  - `text-to-image` - Генерация изображений из текста
  - `image-to-video` - Генерация видео из изображений
  - `text-to-video` - Генерация видео из текста
  - `image-to-image` - Трансформация изображений
  - `audio-to-text` - Транскрипция аудио
  - `text-to-audio` - Синтез речи
  - `multimodal` - Мультимодальные возможности
- `cost_details` (jsonb) - Информация о ценах
- `capabilities` (text[]) - Массив возможностей: `['function_calling', 'streaming', 'vision']`
- `is_default` (boolean) - Модель по умолчанию для своего типа
- `is_enabled` (boolean) - Активна ли модель
- `metadata` (jsonb) - Дополнительная информация: context_window, max_output_tokens и т.д.
- `created_at`, `updated_at` (timestamp)

**Пример:**
```typescript
{
  id: 'minimax-m2',
  providerId: 'minimax',
  name: 'MiniMax-M2',
  type: 'text-to-text',
  costDetails: {
    input_price_per_1k_tokens: 0.001,
    output_price_per_1k_tokens: 0.003
  },
  capabilities: ['function_calling', 'streaming', 'multimodal'],
  isDefault: false,
  isEnabled: true,
  metadata: {
    context_window: 245000,
    max_output_tokens: 16000,
    supports_json_mode: true
  }
}
```

---

## Использование в коде

### 1. Импорт схемы

```typescript
import { aiProviders, aiModels } from '@scrimspec/db';
import { db } from '@/shared/lib/db';
import { eq } from 'drizzle-orm';
```

### 2. Получение списка провайдеров

```typescript
const providers = await db
  .select()
  .from(aiProviders);
```

### 3. Получение моделей конкретного типа

```typescript
// Получить все text-to-text модели
const textModels = await db
  .select()
  .from(aiModels)
  .where(eq(aiModels.type, 'text-to-text'))
  .where(eq(aiModels.isEnabled, true));
```

### 4. Получение модели по умолчанию

```typescript
// Получить модель по умолчанию для генерации изображений
const [defaultImageModel] = await db
  .select()
  .from(aiModels)
  .where(eq(aiModels.type, 'text-to-image'))
  .where(eq(aiModels.isDefault, true))
  .limit(1);
```

### 5. Получение модели с информацией о провайдере

```typescript
const modelsWithProviders = await db
  .select({
    model: aiModels,
    provider: aiProviders,
  })
  .from(aiModels)
  .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
  .where(eq(aiModels.isEnabled, true));
```

### 6. Динамическое создание клиента на основе провайдера

```typescript
async function getAIClient(modelId: string) {
  const [modelWithProvider] = await db
    .select({
      model: aiModels,
      provider: aiProviders,
    })
    .from(aiModels)
    .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .where(eq(aiModels.id, modelId))
    .limit(1);

  if (!modelWithProvider) {
    throw new Error(`Model ${modelId} not found`);
  }

  const { model, provider } = modelWithProvider;
  const apiKey = process.env[provider.apiKeyEnvVarName];

  if (!apiKey) {
    throw new Error(`API key not found: ${provider.apiKeyEnvVarName}`);
  }

  // Создать клиент в зависимости от провайдера
  if (provider.id === 'minimax') {
    return createTextClient({
      apiKey,
      baseUrl: provider.apiBaseUrl
    });
  } else if (provider.id === 'google_gemini') {
    return new GoogleGenerativeAI(apiKey);
  }

  throw new Error(`Unsupported provider: ${provider.id}`);
}
```

---

## Миграции

### Применение миграций

```bash
# Генерация новой миграции (уже выполнено)
cd packages/db
pnpm generate

# Применение миграций к БД
pnpm push  # или pnpm migrate:run
```

### Файлы миграций

1. **`0003_dear_jocasta.sql`** - Создание таблиц и enums
   - CREATE TYPE auth_type
   - CREATE TYPE model_type
   - CREATE TABLE ai_providers
   - CREATE TABLE ai_models
   - Foreign key constraints

2. **`0004_seed_ai_providers_and_models.sql`** - Seed данные
   - Google Gemini провайдер + 4 модели
   - MiniMax провайдер + 2 модели

---

## Seed данные

После применения миграции `0004_seed_ai_providers_and_models.sql` будут доступны:

### Провайдеры
- **Google Gemini** (`google_gemini`)
- **MiniMax** (`minimax`)

### Модели Google Gemini
- `gemini-2.0-flash-exp` - Experimental text generation (бесплатно)
- `gemini-1.5-pro` - Advanced text generation with long context
- `gemini-1.5-flash` - Fast text generation
- `gemini-2.5-flash-image` - Image generation (по умолчанию для text-to-image)

### Модели MiniMax
- `minimax-m2` - Text generation with function calling
- `minimax-halu-video` - Video generation from images (по умолчанию для image-to-video)

---

## Расширение системы

### Добавление нового провайдера

```sql
INSERT INTO aes_core.ai_providers (
  id,
  name,
  api_base_url,
  authentication_type,
  api_key_env_var_name,
  metadata
) VALUES (
  'openai',
  'OpenAI',
  'https://api.openai.com/v1',
  'bearer_token',
  'OPENAI_API_KEY',
  '{"docs_url": "https://platform.openai.com/docs"}'::jsonb
);
```

### Добавление новой модели

```sql
INSERT INTO aes_core.ai_models (
  id,
  provider_id,
  name,
  type,
  cost_details,
  capabilities,
  is_default,
  is_enabled,
  metadata
) VALUES (
  'gpt-4o',
  'openai',
  'GPT-4 Optimized',
  'text-to-text',
  '{"input_price_per_1m_tokens": 2.5, "output_price_per_1m_tokens": 10.0}'::jsonb,
  ARRAY['function_calling', 'streaming', 'vision'],
  false,
  true,
  '{"context_window": 128000, "max_output_tokens": 16384}'::jsonb
);
```

---

## Best Practices

1. **Всегда проверяйте `is_enabled`** перед использованием модели
2. **Используйте `is_default`** для выбора модели по умолчанию для конкретного типа
3. **Храните API ключи в переменных окружения**, не в коде
4. **Логируйте использование моделей** для отслеживания расходов
5. **Обновляйте `cost_details`** при изменении цен провайдеров
6. **Используйте `metadata`** для хранения специфичной информации о модели

---

## Примеры интеграции

### В generation.ts

```typescript
import { aiModels, aiProviders } from '@scrimspec/db';

// Получить модель для генерации сценариев
const [textModel] = await db
  .select()
  .from(aiModels)
  .where(eq(aiModels.type, 'text-to-text'))
  .where(eq(aiModels.providerId, 'minimax'))
  .where(eq(aiModels.isEnabled, true))
  .limit(1);

// Использовать модель для генерации
const client = createTextClient({
  apiKey: process.env[textModel.provider.apiKeyEnvVarName]
});
```

### В keyframe worker

```typescript
// Получить модель для генерации keyframes
const [imageModel] = await db
  .select()
  .from(aiModels)
  .where(eq(aiModels.type, 'text-to-image'))
  .where(eq(aiModels.isDefault, true))
  .limit(1);
```

---

## Дополнительные возможности

- **A/B тестирование моделей**: Используйте несколько моделей с `is_enabled=true`
- **Fallback chain**: Если одна модель недоступна, переключайтесь на другую
- **Cost tracking**: Используйте `cost_details` для расчета стоимости операций
- **Feature flags**: Используйте `capabilities` для проверки возможностей модели

---

## Поддержка

Для вопросов по использованию таблиц AI providers & models:
- Проверьте примеры в этом документе
- Изучите seed данные в `0004_seed_ai_providers_and_models.sql`
- Обратитесь к команде разработки
