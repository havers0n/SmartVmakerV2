# Migration Summary - AI Providers & Models

## 📋 Что было сделано

### 1. Обновлена схема БД (`packages/db/migrations/schema.ts`)

#### Добавлены новые ENUMS:
- **`auth_type`** - типы аутентификации API
  - `bearer_token` - Bearer токен в Authorization header
  - `api_key_header` - API ключ в custom header
  - `query_param` - API ключ как query параметр

- **`model_type`** - типы AI моделей
  - `text-to-text` - Текстовая генерация (LLM)
  - `text-to-image` - Генерация изображений
  - `image-to-video` - Генерация видео из изображений
  - `text-to-video` - Генерация видео из текста
  - `image-to-image` - Трансформация изображений
  - `audio-to-text` - Транскрипция
  - `text-to-audio` - Синтез речи
  - `multimodal` - Мультимодальные модели

#### Добавлены новые таблицы:

**`aes_core.ai_providers`** (8 полей)
```typescript
{
  id: text (PK)                    // 'google_gemini', 'minimax'
  name: text                       // "Google Gemini", "MiniMax"
  apiBaseUrl: text                 // "https://api.minimax.io/v1"
  authenticationType: auth_type    // 'bearer_token' | 'api_key_header' | 'query_param'
  apiKeyEnvVarName: text           // 'GEMINI_API_KEY', 'MINIMAX_API_KEY'
  metadata: jsonb                  // Дополнительная информация
  createdAt: timestamp
  updatedAt: timestamp
}
```

**`aes_core.ai_models`** (11 полей)
```typescript
{
  id: text (PK)                    // 'gemini-2.5-flash-image', 'minimax-m2'
  providerId: text (FK)            // Ссылка на ai_providers.id
  name: text                       // "Gemini Flash Image", "MiniMax-M2"
  type: model_type                 // 'text-to-text' | 'text-to-image' | ...
  costDetails: jsonb               // Информация о ценах
  capabilities: text[]             // ['function_calling', 'streaming', 'vision']
  isDefault: boolean               // Модель по умолчанию для своего типа
  isEnabled: boolean               // Активна ли модель
  metadata: jsonb                  // Дополнительная информация
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 2. Сгенерированы миграции

#### `migrations/0003_dear_jocasta.sql`
- CREATE TYPE для auth_type
- CREATE TYPE для model_type
- CREATE TABLE ai_providers
- CREATE TABLE ai_models
- Foreign key constraint (ai_models.provider_id → ai_providers.id)

#### `migrations/0004_seed_ai_providers_and_models.sql`
Seed данные для:
- **2 провайдера**: Google Gemini, MiniMax
- **6 моделей**:
  - Google Gemini: 4 модели (2.0 Flash Exp, 1.5 Pro, 1.5 Flash, 2.5 Flash Image)
  - MiniMax: 2 модели (M2 text, HALU video)

### 3. Обновлены импорты

- **`generation.ts`** - добавлены импорты `aiProviders`, `aiModels`
- **`src/index.ts`** - автоматически экспортирует все из schema.ts

### 4. Создана документация

- **`AI_PROVIDERS_MODELS.md`** - Полная документация по использованию
- **`examples/ai-models-usage.ts`** - 7 примеров использования API
- **`MIGRATION_SUMMARY.md`** - Этот файл

---

## 🚀 Как применить миграции

### Вариант 1: Через Drizzle Kit Push (Рекомендуется для dev)

```bash
cd packages/db
pnpm push
```

Это применит все pending миграции к вашей БД.

### Вариант 2: Через прямое выполнение SQL

```bash
# Применить основную миграцию
psql -h <host> -U <user> -d <database> -f migrations/0003_dear_jocasta.sql

# Применить seed данные
psql -h <host> -U <user> -d <database> -f migrations/0004_seed_ai_providers_and_models.sql
```

### Вариант 3: Через Supabase CLI

```bash
cd packages/db
supabase db push
```

---

## ✅ Проверка миграций

### 1. Проверить создание таблиц

```sql
-- Проверить провайдеров
SELECT * FROM aes_core.ai_providers;

-- Проверить модели
SELECT * FROM aes_core.ai_models;

-- Проверить модели с провайдерами
SELECT
  p.name as provider,
  m.name as model,
  m.type,
  m.is_default,
  m.is_enabled
FROM aes_core.ai_models m
JOIN aes_core.ai_providers p ON m.provider_id = p.id
ORDER BY p.name, m.type;
```

### 2. Проверить enums

```sql
-- Проверить auth_type enum
SELECT enum_range(NULL::auth_type);

-- Проверить model_type enum
SELECT enum_range(NULL::model_type);
```

### 3. Запустить примеры использования

```bash
cd packages/db
tsx examples/ai-models-usage.ts
```

Вы должны увидеть:
- Список всех провайдеров (Google Gemini, MiniMax)
- Список всех моделей с их типами и статусами
- Проверку доступности моделей

---

## 📊 Seed данные после миграции

### Провайдеры (2 записи)

| ID             | Name          | API Base URL                            | Auth Type      | Env Var         |
|----------------|---------------|-----------------------------------------|----------------|-----------------|
| google_gemini  | Google Gemini | https://generativelanguage.googleapis.com/v1beta | query_param    | GEMINI_API_KEY  |
| minimax        | MiniMax       | https://api.minimax.io/v1               | bearer_token   | MINIMAX_API_KEY |

### Модели (6 записей)

| ID                      | Provider      | Type           | Is Default | Is Enabled |
|-------------------------|---------------|----------------|------------|------------|
| gemini-2.0-flash-exp    | Google Gemini | text-to-text   | false      | true       |
| gemini-1.5-pro          | Google Gemini | text-to-text   | false      | true       |
| gemini-1.5-flash        | Google Gemini | text-to-text   | false      | true       |
| gemini-2.5-flash-image  | Google Gemini | text-to-image  | **true**   | true       |
| minimax-m2              | MiniMax       | text-to-text   | false      | true       |
| minimax-halu-video      | MiniMax       | image-to-video | **true**   | true       |

---

## 🔧 Использование в коде

### Базовый пример

```typescript
import { db } from '@/shared/lib/db';
import { aiProviders, aiModels } from '@/shared/lib/schema';
import { eq, and } from 'drizzle-orm';

// Получить модель по умолчанию для генерации изображений
const [imageModel] = await db
  .select()
  .from(aiModels)
  .where(and(
    eq(aiModels.type, 'text-to-image'),
    eq(aiModels.isDefault, true),
    eq(aiModels.isEnabled, true)
  ))
  .limit(1);

console.log(imageModel.name); // "Gemini 2.5 Flash Image"
```

### Динамическое создание клиента

```typescript
// Получить модель с провайдером
const [result] = await db
  .select({
    model: aiModels,
    provider: aiProviders,
  })
  .from(aiModels)
  .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
  .where(eq(aiModels.id, 'minimax-m2'))
  .limit(1);

const { model, provider } = result;

// Создать клиент
const apiKey = process.env[provider.apiKeyEnvVarName];
const client = createTextClient({
  apiKey,
  baseUrl: provider.apiBaseUrl
});
```

---

## 🎯 Следующие шаги

### 1. Применить миграции к БД
```bash
cd packages/db
pnpm push
```

### 2. Проверить seed данные
```bash
tsx examples/ai-models-usage.ts
```

### 3. Обновить код генерации
- Использовать `aiModels` вместо hardcoded model IDs
- Добавить выбор модели в UI
- Реализовать fallback на другую модель при ошибке

### 4. Добавить новые провайдеры/модели (опционально)
```sql
-- Пример: добавить OpenAI
INSERT INTO aes_core.ai_providers (id, name, api_base_url, authentication_type, api_key_env_var_name)
VALUES ('openai', 'OpenAI', 'https://api.openai.com/v1', 'bearer_token', 'OPENAI_API_KEY');

-- Добавить GPT-4
INSERT INTO aes_core.ai_models (id, provider_id, name, type, capabilities, is_enabled)
VALUES ('gpt-4o', 'openai', 'GPT-4 Optimized', 'text-to-text', ARRAY['function_calling', 'streaming', 'vision'], true);
```

---

## 📚 Дополнительные ресурсы

- **Полная документация**: `packages/db/AI_PROVIDERS_MODELS.md`
- **Примеры кода**: `packages/db/examples/ai-models-usage.ts`
- **Schema**: `packages/db/migrations/schema.ts` (строки 27-37, 316-339)
- **Миграции**:
  - `packages/db/migrations/0003_dear_jocasta.sql`
  - `packages/db/migrations/0004_seed_ai_providers_and_models.sql`

---

## ❓ Часто задаваемые вопросы

### Q: Как добавить нового провайдера?
A: Выполните INSERT в `ai_providers`, затем добавьте модели в `ai_models`

### Q: Как изменить модель по умолчанию?
A: UPDATE `is_default` для нужной модели (и отключите старую default модель)

### Q: Как отключить модель?
A: UPDATE `is_enabled = false` для этой модели

### Q: Можно ли удалить провайдера?
A: Да, но с ним удалятся все его модели (CASCADE)

### Q: Как обновить цены моделей?
A: UPDATE `cost_details` jsonb поле

---

## 🐛 Troubleshooting

### Ошибка: "relation ai_providers does not exist"
- Убедитесь, что миграции применены: `pnpm push`
- Проверьте подключение к правильной БД

### Ошибка: "type auth_type does not exist"
- Миграция 0003 не применена
- Запустите: `psql -f migrations/0003_dear_jocasta.sql`

### Seed данные не загружаются
- Проверьте, что миграция 0003 успешно применена
- Запустите: `psql -f migrations/0004_seed_ai_providers_and_models.sql`

---

**Готово к использованию! 🎉**

После применения миграций система AI providers & models полностью функциональна.
