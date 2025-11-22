# AI Providers & Models System - Готово! ✅

## 🎯 Что было реализовано

Создана централизованная система управления AI провайдерами (Google Gemini, MiniMax, OpenAI и др.) и их моделями с гибкой конфигурацией.

---

## 📦 Структура изменений

### 1. Database Schema (`packages/db/migrations/schema.ts`)

#### Новые ENUMS:
- ✅ `auth_type` - типы аутентификации (`bearer_token`, `api_key_header`, `query_param`)
- ✅ `model_type` - типы моделей (`text-to-text`, `text-to-image`, `image-to-video`, etc.)

#### Новые таблицы:
- ✅ **`aes_core.ai_providers`** (8 полей) - информация о провайдерах AI
  - id, name, apiBaseUrl, authenticationType, apiKeyEnvVarName, metadata, timestamps

- ✅ **`aes_core.ai_models`** (11 полей) - модели с привязкой к провайдерам
  - id, providerId (FK), name, type, costDetails, capabilities, isDefault, isEnabled, metadata, timestamps

### 2. Миграции

#### `migrations/0003_dear_jocasta.sql` ✅
- CREATE TYPE auth_type
- CREATE TYPE model_type
- CREATE TABLE ai_providers
- CREATE TABLE ai_models
- Foreign key constraints

#### `migrations/0004_seed_ai_providers_and_models.sql` ✅
Seed данные:
- **2 провайдера**: Google Gemini, MiniMax
- **6 моделей**:
  - Google: gemini-2.0-flash-exp, gemini-1.5-pro, gemini-1.5-flash, **gemini-2.5-flash-image** (default image)
  - MiniMax: minimax-m2, **minimax-halu-video** (default video)

### 3. Документация

✅ **`packages/db/AI_PROVIDERS_MODELS.md`** (102 KB)
- Полное описание схемы
- Примеры использования в коде
- Best practices
- FAQ и troubleshooting

✅ **`packages/db/MIGRATION_SUMMARY.md`** (13 KB)
- Инструкции по применению миграций
- Проверка корректности
- Таблицы с seed данными

✅ **`packages/db/examples/ai-models-usage.ts`** (10 KB)
- 7 практических примеров:
  1. Получить все провайдеры
  2. Получить все модели с провайдерами
  3. Получить модель по умолчанию для типа
  4. Получить модели провайдера
  5. Создать AI клиент на основе модели
  6. Найти самую дешевую модель
  7. Проверить доступность модели

### 4. Обновлены импорты

✅ **`apps/dashboard/src/app/api/actions/handlers/generation.ts`**
- Добавлены импорты `aiProviders`, `aiModels`

---

## 🚀 Быстрый старт

### 1. Применить миграции

```bash
cd packages/db
pnpm push
```

### 2. Проверить seed данные

```sql
-- В psql или Supabase SQL Editor
SELECT * FROM aes_core.ai_providers;
SELECT * FROM aes_core.ai_models;
```

### 3. Запустить примеры

```bash
cd packages/db
tsx examples/ai-models-usage.ts
```

---

## 💡 Примеры использования

### Получить модель по умолчанию

```typescript
import { db } from '@/shared/lib/db';
import { aiModels } from '@/shared/lib/schema';
import { eq, and } from 'drizzle-orm';

const [imageModel] = await db
  .select()
  .from(aiModels)
  .where(and(
    eq(aiModels.type, 'text-to-image'),
    eq(aiModels.isDefault, true),
    eq(aiModels.isEnabled, true)
  ))
  .limit(1);

// Result: gemini-2.5-flash-image
```

### Создать клиент динамически

```typescript
import { aiProviders, aiModels } from '@/shared/lib/schema';

const [result] = await db
  .select({
    model: aiModels,
    provider: aiProviders,
  })
  .from(aiModels)
  .leftJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
  .where(eq(aiModels.id, 'minimax-m2'))
  .limit(1);

const apiKey = process.env[result.provider.apiKeyEnvVarName];
const client = createTextClient({
  apiKey,
  baseUrl: result.provider.apiBaseUrl
});
```

### Получить все модели провайдера

```typescript
const minimaxModels = await db
  .select()
  .from(aiModels)
  .where(and(
    eq(aiModels.providerId, 'minimax'),
    eq(aiModels.isEnabled, true)
  ));
```

---

## 📊 Seed данные (после миграции)

### Провайдеры

| ID            | Name          | Auth Type    | Env Var          |
|---------------|---------------|--------------|------------------|
| google_gemini | Google Gemini | query_param  | GEMINI_API_KEY   |
| minimax       | MiniMax       | bearer_token | MINIMAX_API_KEY  |

### Модели

| ID                      | Provider | Type           | Default | Enabled |
|-------------------------|----------|----------------|---------|---------|
| gemini-2.0-flash-exp    | Gemini   | text-to-text   | -       | ✅      |
| gemini-1.5-pro          | Gemini   | text-to-text   | -       | ✅      |
| gemini-1.5-flash        | Gemini   | text-to-text   | -       | ✅      |
| **gemini-2.5-flash-image** | Gemini   | text-to-image  | ⭐      | ✅      |
| minimax-m2              | MiniMax  | text-to-text   | -       | ✅      |
| **minimax-halu-video**     | MiniMax  | image-to-video | ⭐      | ✅      |

---

## 🔧 Возможности

### ✅ Централизованное управление
- Все провайдеры и модели в одном месте
- Легко добавлять новые провайдеры (OpenAI, Anthropic, etc.)

### ✅ Гибкая конфигурация
- Разные типы аутентификации (bearer, header, query param)
- Metadata для специфичных настроек
- Cost details для отслеживания расходов

### ✅ Выбор модели по умолчанию
- `isDefault` флаг для каждого типа модели
- Легко переключать модели через UI

### ✅ Включение/отключение
- `isEnabled` флаг для быстрого отключения модели
- Не нужно удалять из БД

### ✅ Rich metadata
- Capabilities: function_calling, streaming, vision, etc.
- Cost details: цены за токены/изображения/секунды
- Технические параметры: context_window, max_output_tokens

---

## 🎯 Дальнейшие улучшения

### Рекомендуемые шаги:

1. **UI для выбора модели**
   - Dropdown в `/hwar/create` для выбора text-to-text модели
   - Dropdown для выбора image модели для keyframes

2. **Fallback chain**
   - Если модель недоступна, попробовать другую
   - Логирование переключений

3. **Cost tracking**
   - Создать таблицу `model_usage` для отслеживания использования
   - Dashboard с расходами по моделям

4. **A/B тестирование**
   - Сравнивать качество разных моделей
   - Автоматический выбор лучшей

5. **Rate limiting**
   - Добавить rate limits в metadata провайдеров
   - Автоматическое переключение при превышении лимита

---

## 📚 Документация

Полная документация доступна в:
- **`packages/db/AI_PROVIDERS_MODELS.md`** - Детальное описание и примеры
- **`packages/db/MIGRATION_SUMMARY.md`** - Инструкции по миграции
- **`packages/db/examples/ai-models-usage.ts`** - Код примеров

---

## ✅ Checklist для внедрения

- [x] Создать enums (auth_type, model_type)
- [x] Создать таблицы (ai_providers, ai_models)
- [x] Сгенерировать миграции
- [x] Создать seed данные
- [x] Написать документацию
- [x] Создать примеры использования
- [x] Обновить импорты в generation.ts
- [ ] **Применить миграции к БД** ← СЛЕДУЮЩИЙ ШАГ
- [ ] Обновить generation.ts для использования таблиц
- [ ] Создать UI для выбора модели
- [ ] Добавить cost tracking

---

## 🎉 Готово к использованию!

Система AI Providers & Models полностью готова. Примените миграции и начинайте использовать:

```bash
cd packages/db
pnpm push
tsx examples/ai-models-usage.ts
```

**Happy coding! 🚀**
