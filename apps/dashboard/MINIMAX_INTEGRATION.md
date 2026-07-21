# MiniMax-M2 Integration в Generation Pipeline

## Обзор

В action handler `generation.startProject` была успешно интегрирована модель **MiniMax-M2** с поддержкой **Function Calling**, заменив Google Gemini.

## Что изменилось

### 1. Зависимости

Добавлены новые пакеты:
- `@scrimspec/halu-client@0.1.0` - клиент для работы с MiniMax API
- `openai@6.7.0` - для совместимости типов (MiniMax использует OpenAI-compatible API)

### 2. Файл: `apps/dashboard/src/app/api/actions/handlers/generation.ts`

#### Импорты
```typescript
import { createTextClient, generateScenariosWithTools } from '@scrimspec/halu-client';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
```

#### Новые функции

**`executeGetStoryPresetDetails(presetId: string)`**
- Загружает детали шаблона истории из БД
- Возвращает: name, description, tags, targetDurationSeconds, beats

**`executeGetCharacterDetails(characterId: string)`**
- Загружает детали персонажа из БД
- Возвращает: name, description, stylePresets, referenceImageUrls

**`generateScenariosWithMiniMax(input)`** (замена `generateScenariosWithGemini`)
- Использует MiniMax-M2 для генерации сценариев
- Поддерживает Function Calling с 3 инструментами:
  1. `get_story_preset_details` - получение данных о шаблоне
  2. `get_character_details` - получение данных о персонаже
  3. `generate_video_scenarios` - финальная генерация сценариев

#### Логика работы

1. **Первый вызов MiniMax-M2**: Модель анализирует запрос и решает, нужны ли дополнительные данные
2. **Выполнение tool calls** (если требуется): Загружаются preset или character из БД
3. **Второй вызов MiniMax-M2** (если были tool calls): Модель генерирует финальные сценарии с учетом полученных данных
4. **Возврат результата**: Массив сценариев с AES scoring, scenes, emotional curves

## Переменные окружения

Необходимо установить:

```env
MINIMAX_API_KEY=your_minimax_api_key_here
```

Если ключ не установлен, система вернет mock-данные для разработки.

## Структура сценария

```typescript
{
  title: string;              // Название концепции
  description: string;        // Краткое описание
  aesScore: number;          // AES score (0-100)
  hookStrength: number;      // Сила хука (0-100)
  emotionalCurve: string[];  // Эмоциональная кривая
  scenes: [
    {
      phase: 'HOOK' | 'BUILD' | 'PAYOFF' | 'RESOLUTION';
      duration: number;      // Длительность в секундах
      description: string;   // Визуальное описание
    }
  ]
}
```

## Преимущества Function Calling

1. **Обогащение данными**: MiniMax-M2 может запросить дополнительную информацию из библиотеки
2. **Контекстуальность**: Модель получает structured data о preset/character
3. **Гибкость**: Модель сама решает, какие данные ей нужны

## Примеры использования

### Создание проекта с промптом
```typescript
await startProject({
  title: "My Video",
  ratio: "9:16",
  lang: "en",
  source: "prompt",
  prompt: "Create a video about discovering AI technology"
});
```

### Создание проекта с preset
```typescript
await startProject({
  title: "My Video",
  ratio: "16:9",
  lang: "en",
  source: "preset",
  presetId: "uuid-of-story-template"
});
```

MiniMax-M2 автоматически получит детали preset через Function Calling и создаст сценарии на его основе.

## Тестирование

Для тестирования интеграции:

1. Установите `MINIMAX_API_KEY` в `.env`
2. Запустите dashboard: `pnpm dev`
3. Откройте `/hwar/create` и создайте новый проект
4. Проверьте логи в консоли для деталей вызовов MiniMax-M2

## Логирование

Логи включают:
- `Calling MiniMax-M2 for scenario generation`
- `MiniMax-M2 requested tool calls` (если модель запросила данные)
- `Fetched story preset details` / `Fetched character details`
- `Generated scenarios with MiniMax-M2`

## Fallback

Если MiniMax API недоступен или возвращает ошибку, система автоматически вернет mock-сценарии для продолжения работы.

## Дальнейшие улучшения

- [ ] Добавить кэширование ответов MiniMax-M2
- [ ] Реализовать retry логику при ошибках API
- [ ] Добавить streaming для real-time генерации
- [ ] Расширить набор tools (например, `get_trend_analysis`, `get_style_guide`)
- [ ] Добавить A/B тестирование между MiniMax и другими моделями

## Архитектура

```
User Request
    ↓
generation.startProject
    ↓
generateScenariosWithMiniMax
    ↓
MiniMax-M2 (First Call)
    ↓
Tool Calls? → Yes → Execute Tools → MiniMax-M2 (Second Call)
    ↓ No              ↓
    ↓          Enriched Data
    ↓                 ↓
generate_video_scenarios
    ↓
Return Scenarios
```

## Контакты

Для вопросов по интеграции обратитесь к команде разработки или проверьте:
- `packages/halu-client/README.md` - документация HALU-клиента
- `packages/halu-client/test-text.ts` - примеры использования
