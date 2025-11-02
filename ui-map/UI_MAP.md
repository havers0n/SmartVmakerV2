# Scrimspec UI Map

**Дата создания:** 2025-11-02
**Монорепозиторий:** scrimspec
**Основное приложение:** apps/dashboard
**Тип роутера:** App Router (Next.js 14)

---

## 1. Обзор монорепозитория

### Воркспейсы

```
scrimspec/
├── apps/
│   └── dashboard/          # Next.js 14 App Router приложение
├── packages/
│   ├── api-client/         # API клиент
│   ├── core-domain/        # Доменная логика
│   ├── db/                 # Database (Drizzle ORM + Supabase)
│   ├── halu-client/        # HALU (MiniMax) API клиент
│   ├── logger/             # Логирование
│   ├── shared-types/       # Общие типы TypeScript
│   ├── storage-client/     # Cloudflare R2 storage клиент
│   └── workers/            # Background workers (ingest, analysis, keyframe, animation)
└── tools/
```

### Технологический стек Dashboard

- **Framework:** Next.js 14 (App Router)
- **UI Components:** Radix UI + shadcn/ui
- **Forms:** React Hook Form + Zod валидация
- **State Management:** TanStack Query (React Query)
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Storage:** Cloudflare R2 (для keyframes и video assets)
- **Animations:** Framer Motion

---

## 2. Таблица маршрутов

### Основные маршруты

| Путь | Файл | Тип | Params | Layouts | Loading/Error | Links Out | Links In |
|------|------|-----|--------|---------|---------------|-----------|----------|
| `/` | `apps/dashboard/src/app/page.tsx` | page | - | root | ❌/❌ | `/ingest`, `/analysis`, `/generation`, `/hwar` | - |
| `/login` | `apps/dashboard/src/app/login/page.tsx` | page | - | root | ❌/❌ | - | - |
| `/signup` | `apps/dashboard/src/app/signup/page.tsx` | page | - | root | ❌/❌ | - | - |
| `/ingest` | `apps/dashboard/src/app/ingest/page.tsx` | page | - | root | ❌/❌ | - | `/` |
| `/analysis` | `apps/dashboard/src/app/analysis/page.tsx` | page | - | root | ❌/❌ | `/ingest` | `/` |
| `/generation` | `apps/dashboard/src/app/generation/page.tsx` | page | - | root | ❌/❌ | - | `/` |

### HWAR (Video Generation Factory) Маршруты

| Путь | Файл | Тип | Params | Layouts | Loading/Error | Links Out | Links In |
|------|------|-----|--------|---------|---------------|-----------|----------|
| `/hwar` | `apps/dashboard/src/app/hwar/page.tsx` | page | - | root + hwar | ❌/❌ | `/hwar/create`, `/hwar/factory`, `/hwar/library` | `/` |
| `/hwar/create` | `apps/dashboard/src/app/hwar/create/page.tsx` | page | - | root + hwar | ❌/❌ | `/hwar/create/new`, `/hwar/create/[project_id]` | `/hwar` |
| `/hwar/create/new` | `apps/dashboard/src/app/hwar/create/new/page.tsx` | page | - | root + hwar | ❌/❌ | `/hwar/create`, `/hwar/create/[project_id]`, `/hwar/library/presets` | `/hwar/create` |
| `/hwar/create/[project_id]` | `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx` | page | `project_id` | root + hwar | ❌/❌ | `/hwar/create` | `/hwar/create`, `/hwar/create/new` |

### HWAR Factory Маршруты

| Путь | Файл | Тип | Params | Layouts | Loading/Error | Links Out | Links In |
|------|------|-----|--------|---------|---------------|-----------|----------|
| `/hwar/factory` | `apps/dashboard/src/app/hwar/factory/page.tsx` | page | - | root + hwar | ❌/❌ | все подстраницы factory | `/hwar` |
| `/hwar/factory/harvests` | `apps/dashboard/src/app/hwar/factory/harvests/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/factory` |
| `/hwar/factory/analysis` | `apps/dashboard/src/app/hwar/factory/analysis/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/factory` |
| `/hwar/factory/queues` | `apps/dashboard/src/app/hwar/factory/queues/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/factory` |
| `/hwar/factory/workers` | `apps/dashboard/src/app/hwar/factory/workers/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/factory` |
| `/hwar/factory/batches` | `apps/dashboard/src/app/hwar/factory/batches/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/factory` |
| `/hwar/factory/analytics` | `apps/dashboard/src/app/hwar/factory/analytics/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/factory` |
| `/hwar/factory/settings` | `apps/dashboard/src/app/hwar/factory/settings/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/factory` |

### HWAR Library Маршруты

| Путь | Файл | Тип | Params | Layouts | Loading/Error | Links Out | Links In |
|------|------|-----|--------|---------|---------------|-----------|----------|
| `/hwar/library` | `apps/dashboard/src/app/hwar/library/page.tsx` | page | - | root + hwar | ❌/❌ | все подстраницы library | `/hwar` |
| `/hwar/library/presets` | `apps/dashboard/src/app/hwar/library/presets/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/library`, `/hwar/create/new` |
| `/hwar/library/characters` | `apps/dashboard/src/app/hwar/library/characters/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/library` |
| `/hwar/library/datasets` | `apps/dashboard/src/app/hwar/library/datasets/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/library` |
| `/hwar/library/templates` | `apps/dashboard/src/app/hwar/library/templates/page.tsx` | page | - | root + hwar | ❌/❌ | - | `/hwar/library` |

### API Endpoints (Route Handlers)

| Путь | Файл | Метод | Описание |
|------|------|-------|----------|
| `/api/health/db` | `apps/dashboard/src/app/api/health/db/route.ts` | GET | Database health check |
| `/api/videos` | `apps/dashboard/src/app/api/videos/route.ts` | GET | Получение списка ingested videos |
| `/api/analytics/trends` | `apps/dashboard/src/app/api/analytics/trends/route.ts` | GET | Получение YouTube трендов |
| `/api/actions` | `apps/dashboard/src/app/api/actions/route.ts` | POST | Action Runner - универсальный обработчик всех server actions |
| `/api/generation/projects/[project_id]` | `apps/dashboard/src/app/api/generation/projects/[project_id]/route.ts` | GET | Получение проекта по ID |
| `/api/generation/projects/[project_id]/assets` | `apps/dashboard/src/app/api/generation/projects/[project_id]/assets/route.ts` | GET | Получение assets (keyframes) проекта |
| `/api/r2/upload-url` | `apps/dashboard/src/app/api/r2/upload-url/route.ts` | POST | Генерация presigned URL для загрузки в R2 |
| `/api/r2/download-url` | `apps/dashboard/src/app/api/r2/download-url/route.ts` | POST | Генерация presigned URL для скачивания из R2 |
| `/api/webhooks/halu` | `apps/dashboard/src/app/api/webhooks/halu/route.ts` | POST | Webhook для HALU (MiniMax) API callbacks |

---

## 3. Таблица экранов с формами и действиями

### Home (`/`)

- **Компоненты:** WelcomeCard, IngestCard, AnalyzeCard, SystemOverviewCards
- **Формы:** ❌
- **Состояния:** loading ❌ | error ❌ | empty ❌
- **Навигация → :** `/ingest`, `/analysis`

---

### Ingest (`/ingest`)

apps/dashboard/src/app/ingest/page.tsx:8

- **Компоненты:** StartIngestForm, IngestJobsTable
- **Формы:**
  - **StartIngestForm** (`apps/dashboard/src/features/ingest/StartIngestForm.tsx`)
    - **Поля:**
      1. `query` (text, обязательное) - Поисковый запрос
         - Валидация: `z.string().min(3)`
      2. `order` (select, опционально) - Сортировка
         - Опции: `date`, `rating`, `relevance`, `viewCount`
      3. `videoDuration` (select, опционально) - Длительность
         - Опции: `any`, `short`, `medium`, `long`
      4. `maxResults` (number, опционально) - Макс. результатов (1-50)
      5. `publishedAfter` (date, опционально) - Опубликовано после
      6. `safeSearch` (select, опционально) - Безопасный поиск
         - Опции: `none`, `moderate`, `strict`
      7. `videoDefinition` (select, опционально) - Качество
         - Опции: `any`, `high`, `standard`
    - **Submit → :** `startIngestSearch` action (`/api/actions` → `ingest.startSearch`)
    - **Успех → :** Toast с Job ID, форма очищается
- **Состояния:** loading ✅ | error ✅ | empty ❌

---

### Analysis (`/analysis`)

apps/dashboard/src/app/analysis/page.tsx:57

- **Компоненты:** VideoTable, AnalyzerSelector, PaginationComponent
- **Формы:** ❌ (встроенный выбор чекбоксами)
- **Действия:**
  - **Выбор видео** → выбор через checkbox
  - **Выбор анализатора** → select: `gemini`, `nanobanana`
  - **Submit:** `callAction('analysis.startAnalysis')` → создаёт analysis jobs
- **Состояния:** loading ✅ | error ✅ | empty ✅
- **Навигация → :** `/ingest` (если empty state)

---

### Generation (`/generation`)

apps/dashboard/src/app/generation/page.tsx:60

- **Компоненты:** CreateShortForm, GenerationStatusTable, ShortsTable, AssetsTable
- **Формы:**
  - **CreateShortForm** (встроенная)
    - **Поля:**
      1. `templateId` (text, обязательное) - Template ID
      2. `provider` (select, обязательное) - Provider
         - Опции: `minimax`, `hailuo`
    - **Submit → :** `POST /api/generation/shorts`
    - **Успех → :** Обновление статуса, auto-refresh
- **Состояния:** loading ✅ | error ✅ | empty ✅

---

### HWAR Overview (`/hwar`)

apps/dashboard/src/app/hwar/page.tsx:8

- **Компоненты:** CreateCard, FactoryCard, LibraryCard
- **Формы:** ❌
- **Навигация → :**
  - Create → `/hwar/create`
  - Factory → `/hwar/factory`
  - Library → `/hwar/library`

---

### HWAR Create Index (`/hwar/create`)

apps/dashboard/src/app/hwar/create/page.tsx:27

- **Компоненты:** ProjectsGrid, NewProjectButton
- **Формы:** ❌
- **Состояния:** loading ✅ | error ❌ | empty ✅ (EmptyState с CTA)
- **Действия:**
  - **New Project button** → `/hwar/create/new`
  - **Project card click** → `/hwar/create/[project_id]`
- **API:** `useQuery(['projects'])` - TODO: не реализовано, возвращает пустой массив

---

### HBAR Create - New Project Step 1 (`/hwar/create/new`)

apps/dashboard/src/app/hwar/create/new/page.tsx:29

**Step 1: Project Details**

- **Компоненты:** ProjectDetailsForm, ProgressIndicator (3 шага)
- **Формы:**
  - **ProjectDetailsForm** (встроенная)
    - **Поля:**
      1. `title` (text, опционально) - Project Title
      2. `ratio` (button-group, обязательное) - Aspect Ratio
         - Опции: `16:9`, `9:16`, `4:3`, `3:4`
      3. `lang` (select, обязательное) - Language
         - Опции: `none` (No audio track), `ru`, `en`, `he`, `es`
    - **Submit → :** Локальный стейт, переход на Step 2
- **Навигация:**
  - **Back/Cancel** → `/hwar/create`
  - **Continue** → Step 2

---

### HBAR Create - New Project Step 2 (`/hwar/create/new`)

apps/dashboard/src/app/hwar/create/new/page.tsx:29

**Step 2: Content Source**

- **Компоненты:** ContentSourceTabs (Prompt | Presets | Trends)
- **Формы:**
  - **Prompt Tab:**
    - `prompt` (textarea, обязательное если выбран Prompt)
      - Подсказка: Include AES structure (Attention → Emotion → Solution), emotional arc
  - **Presets Tab:**
    - **Загрузка:** `listStoryTemplates()` action (`/api/actions` → `storyTemplates.list`)
    - **Выбор:** карточки Story Templates
    - **Если пусто:** кнопка "Go to Library" → `/hwar/library/presets`
  - **Trends Tab:**
    - **Загрузка:** `GET /api/analytics/trends`
    - **Выбор:** карточки Trends с insights
- **Состояния:** loading ✅ (для presets/trends) | error ❌ | empty ✅
- **Навигация:**
  - **Back** → Step 1
  - **Continue** → Step 3 (только если выбран source)

---

### HBAR Create - New Project Step 3 (`/hwar/create/new`)

apps/dashboard/src/app/hwar/create/new/page.tsx:29

**Step 3: Review & Generate**

- **Компоненты:** ReviewSummary (Aspect Ratio, Language, Source, Prompt/Preset/Trend)
- **Формы:** ❌ (только review)
- **Действия:**
  - **Create Project** → `startGenerationProject()` action
    - Action: `generation.startProject`
    - Endpoint: `/api/actions`
    - Payload: `{ title, ratio, lang, source, prompt?, presetId?, trendId? }`
    - **Успех → :** редирект на `/hwar/create/[project.id]`
- **Навигация:**
  - **Back** → Step 2
  - **Create Project** → `/hwar/create/[project_id]`

---

### HBAR Create - Project Detail (`/hwar/create/[project_id]`)

apps/dashboard/src/app/hwar/create/[project_id]/page.tsx:55

- **Компоненты:** ProjectHeader, ScenarioGrid, KeyframePreview
- **Формы:**
  - **ScenarioSelection** (встроенная)
    - **Выбор:** карточки Scenarios (title, description, aesScore, hookStrength, emotionalCurve, scenes)
    - **Submit → :** `generateKeyframes()` action
      - Action: `generation.generateKeyframes`
      - Endpoint: `/api/actions`
      - Payload: `{ projectId, selectedScenarioIndex }`
      - **Успех → :** обновление project meta, запуск polling keyframe assets
- **Состояния:**
  - **Project loading:** loading ✅ | error ✅
  - **Keyframes generation:** polling каждые 3s (`GET /api/generation/projects/[id]/assets`)
  - **Keyframe statuses:** `pending`, `processing`, `completed`, `failed`
- **Компоненты:**
  - **Scenario Cards:** aesScore, hookStrength, emotionalCurve (badges), scenes
  - **Keyframe Preview:** First & Last frames для каждой сцены, R2Image компонент
- **Навигация:**
  - **Back to Projects** → `/hwar/create`

---

### HWAR Factory Subsections

Все Factory страницы используют **FactorySidebar** (`apps/dashboard/src/features/hwar-factory/components/factory-sidebar.tsx`)

#### Factory Sidebar Navigation:
- **Harvests** → `/hwar/factory/harvests`
- **Analysis Queue** → `/hwar/factory/analysis`
- **Queues** → `/hwar/factory/queues`
- **Workers** → `/hwar/factory/workers`
- **Batches** → `/hwar/factory/batches`
- **Analytics** → `/hwar/factory/analytics`
- **Settings** → `/hwar/factory/settings`

**Примечание:** Конкретные компоненты этих страниц не были прочитаны, необходимо дополнительное исследование.

---

### HWAR Library Subsections

Все Library страницы используют **LibrarySidebar** (`apps/dashboard/src/features/hwar-factory/components/library-sidebar.tsx`)

#### Library Sidebar Navigation:
- **Presets** → `/hwar/library/presets`
- **Characters** → `/hwar/library/characters`
- **Datasets** → `/hwar/library/datasets`
- **Templates** → `/hwar/library/templates`

**Примечание:** Конкретные компоненты этих страниц не были прочитаны, необходимо дополнительное исследование.

---

## 4. Связи: Экран → Server Action/API → Файл

### Ingest Flow

1. **StartIngestForm** (`apps/dashboard/src/features/ingest/StartIngestForm.tsx:39`)
   - Submit → `startIngestSearch()` (`apps/dashboard/src/shared/api/actions.ts:72`)
   - Action → `POST /api/actions` с `action: 'ingest.startSearch'`
   - Handler → `apps/dashboard/src/app/api/actions/route.ts` (Action Runner)
   - Worker → `packages/workers` (ingest worker)

### Analysis Flow

1. **Analysis Page** (`apps/dashboard/src/app/analysis/page.tsx:57`)
   - Submit → `callAction('analysis.startAnalysis', { videoIds })` (`apps/dashboard/src/shared/api/actions.ts:26`)
   - Action → `POST /api/actions` с `action: 'analysis.startAnalysis'`
   - Handler → `apps/dashboard/src/app/api/actions/route.ts` (Action Runner)
   - Worker → `packages/workers` (analysis worker)

### HBAR Create Flow

1. **New Project Step 2 - Presets Tab** (`apps/dashboard/src/app/hwar/create/new/page.tsx:42`)
   - Load → `listStoryTemplates()` (`apps/dashboard/src/shared/api/actions.ts:84`)
   - Action → `POST /api/actions` с `action: 'storyTemplates.list'`
   - Handler → `apps/dashboard/src/app/api/actions/route.ts`

2. **New Project Step 2 - Trends Tab** (`apps/dashboard/src/app/hwar/create/new/page.tsx:50`)
   - Load → `fetch('/api/analytics/trends')`
   - Route → `apps/dashboard/src/app/api/analytics/trends/route.ts`

3. **New Project Step 3 - Create Project** (`apps/dashboard/src/app/hwar/create/new/page.tsx:57`)
   - Submit → `startGenerationProject()` (`apps/dashboard/src/shared/api/actions.ts:128`)
   - Action → `POST /api/actions` с `action: 'generation.startProject'`
   - Handler → `apps/dashboard/src/app/api/actions/route.ts`
   - Redirect → `/hwar/create/[project_id]`

4. **Project Detail - Generate Keyframes** (`apps/dashboard/src/app/hwar/create/[project_id]/page.tsx:124`)
   - Submit → `generateKeyframes()` (`apps/dashboard/src/shared/api/actions.ts:132`)
   - Action → `POST /api/actions` с `action: 'generation.generateKeyframes'`
   - Handler → `apps/dashboard/src/app/api/actions/route.ts`
   - Worker → `packages/workers` (keyframe worker)
   - Polling → `GET /api/generation/projects/[project_id]/assets` (каждые 3s)
   - Route → `apps/dashboard/src/app/api/generation/projects/[project_id]/assets/route.ts`

### Action Runner Pattern

Все server actions идут через единый endpoint `/api/actions`:

```typescript
// apps/dashboard/src/shared/api/actions.ts
export async function callAction<T>(action: string, payload: unknown): Promise<T> {
  const response = await fetch('/api/actions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  // ...
}
```

**Зарегистрированные actions:**
- `ingest.startSearch`
- `analysis.startAnalysis`
- `storyTemplates.create`, `storyTemplates.list`, `storyTemplates.getById`, `storyTemplates.update`, `storyTemplates.delete`
- `characters.create`, `characters.list`, `characters.getById`, `characters.update`, `characters.delete`
- `generation.startProject`
- `generation.generateKeyframes`
- `generation.startAnimation`

---

## 5. HBAR Create - Пошаговая воронка

### Визуальный флоу (см. `ui-map/hbar.flow.mmd`)

**Полный путь пользователя:**

1. **Вход:** Пользователь переходит на `/hwar/create`
   - Видит список проектов (пока пустой - TODO)
   - Кликает "New Project" → `/hwar/create/new`

2. **Step 1: Project Details**
   - Вводит название проекта (опционально)
   - Выбирает Aspect Ratio: `16:9`, `9:16`, `4:3`, `3:4` (кнопки)
   - Выбирает язык: `none`, `ru`, `en`, `he`, `es` (select)
   - Кликает "Continue" → переход на Step 2

3. **Step 2: Content Source** (3 таба)

   **Вариант A: Prompt Tab**
   - Вводит описание видео в textarea
   - Подсказка: Include AES structure (Attention → Emotion → Solution)
   - Кликает "Continue" → переход на Step 3

   **Вариант B: Presets Tab**
   - Загружаются Story Templates (action: `storyTemplates.list`)
   - Если пусто → кнопка "Go to Library" → `/hwar/library/presets`
   - Выбирает template card (показывается: name, description, tags, targetDurationSeconds)
   - Кликает "Continue" → переход на Step 3

   **Вариант C: Trends Tab**
   - Загружаются trends (GET `/api/analytics/trends`)
   - Если пусто → показывается Empty State
   - Выбирает trend card (показывается: title, description, insights)
   - Кликает "Continue" → переход на Step 3

4. **Step 3: Review & Generate**
   - Показывается summary: Aspect Ratio, Language, Source type, Prompt/Preset/Trend
   - Информационная карточка: "AI will generate 5 scenario concepts with scoring"
   - Кликает "Create Project"
   - **Action:** `generation.startProject` → создаёт project в БД
   - **Редирект:** `/hwar/create/[project_id]`

5. **Project Detail Page**
   - Загружается project через `GET /api/generation/projects/[project_id]`
   - Показывается project header: title, ratio, status badges
   - **Если `status === 'processing'`**: показываются сгенерированные AI scenarios (обычно 5 штук)
     - Каждый scenario: title, description, aesScore, hookStrength, emotionalCurve, scenes
   - Пользователь выбирает scenario (кликает на карточку)
   - Кликает "Generate Keyframes"
   - **Action:** `generation.generateKeyframes` → создаёт keyframe generation jobs
   - **Polling starts:** каждые 3s вызывается `GET /api/generation/projects/[project_id]/assets`

6. **Keyframe Generation Progress**
   - Для каждой сцены создаются 2 assets: `first` frame и `last` frame
   - Статусы: `pending` → `processing` → `completed` (или `failed`)
   - Во время обработки показываются loaders
   - По завершению отображаются изображения через компонент `R2Image` (загружается через presigned URL из R2)

7. **Next Steps** (пока не реализованы)
   - Animation: `generation.startAnimation` action
   - Финальная сборка видео

---

## 6. Пробелы и риски

### 🔴 Критичные пробелы

1. **Отсутствуют loading.tsx и error.tsx файлы**
   - **Файлы:** Ни одна страница не имеет `loading.tsx` или `error.tsx`
   - **Локации:** Должны быть добавлены в:
     - `apps/dashboard/src/app/loading.tsx` (глобальный)
     - `apps/dashboard/src/app/hwar/create/loading.tsx`
     - `apps/dashboard/src/app/hwar/create/[project_id]/loading.tsx`
     - `apps/dashboard/src/app/analysis/loading.tsx`
     - И т.д.
   - **Риск:** При медленном API нет Suspense fallback, страницы просто "висят"

2. **Projects API не реализован**
   - **Файл:** `apps/dashboard/src/app/hwar/create/page.tsx:30-41`
   - **Код:**
     ```typescript
     queryFn: async () => {
       try {
         // TODO: Replace with actual API call
         // const data = await api.hwar.listProjects();
         // return data;
         return [];
       }
     }
     ```
   - **Риск:** Страница `/hwar/create` всегда показывает EmptyState, даже если проекты есть

3. **Action Runner обработчики не найдены**
   - **Файл:** `apps/dashboard/src/app/api/actions/route.ts`
   - **Отсутствует:** Реализация обработчиков для actions типа `ingest.startSearch`, `generation.startProject`, etc.
   - **Риск:** Все формы, которые используют actions, не могут работать

4. **Отсутствует импорт action handlers**
   - **Файл:** TODO - нужно найти где регистрируются обработчики actions
   - **Риск:** Action Runner endpoint `/api/actions` может не знать как обрабатывать конкретные action names

5. **Generation Scenarios API не найден**
   - **Проблема:** В `/hwar/create/[project_id]` ожидается `project.meta.scenarios`, но не ясно, где они генерируются
   - **Файл:** `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx:175`
   - **Риск:** После создания проекта scenarios могут быть пустыми

### ⚠️ Важные пробелы

6. **Factory и Library страницы не реализованы**
   - **Файлы:** Все страницы в `/hwar/factory/*` и `/hwar/library/*` существуют, но их содержимое не было проверено
   - **Риск:** Неизвестно, работают ли эти страницы или они заглушки

7. **Отсутствует обработка ошибок keyframe generation**
   - **Файл:** `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx:387`
   - **Проблема:** Если asset имеет `status === 'failed'`, показывается только текст "Failed", нет retry или детальной ошибки
   - **Риск:** Пользователь не может повторить генерацию или узнать причину ошибки

8. **Polling не останавливается при unmount**
   - **Файл:** `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx:96-114`
   - **Проблема:** `useQuery` с `refetchInterval` продолжает опрашивать даже если пользователь покинул страницу (хотя в `useEffect` должен быть cleanup)
   - **Риск:** Лишние запросы к API

9. **Нет middleware для auth проверки**
   - **Проблема:** Есть компонент `ProtectedRoute` (`apps/dashboard/src/shared/components/auth/protected-route.tsx`), но используется только на Home странице
   - **Риск:** Другие страницы могут быть доступны без авторизации

10. **Отсутствует валидация на сервере**
    - **Проблема:** Zod валидация есть только на клиенте (в формах)
    - **Риск:** API endpoints (`/api/actions`, route handlers) могут получить невалидные данные, если обойти клиентскую валидацию

### 📝 Желательные улучшения

11. **Нет i18n**
    - **Проблема:** Все тексты захардкожены (часть на английском, часть на русском)
    - **Файлы:** Тексты вразнобой:
      - `apps/dashboard/src/features/ingest/StartIngestForm.tsx` - русские тексты
      - `apps/dashboard/src/app/hwar/create/new/page.tsx` - английские тексты
    - **Риск:** Неконсистентность UI, сложность локализации

12. **Нет тестов для критичных форм**
    - **Проблема:** Отсутствуют unit/integration тесты для:
      - StartIngestForm
      - HBAR Create воронки (Steps 1-3)
      - Project Detail page
    - **Риск:** Регрессии при рефакторинге

13. **Дублирование кода валидации**
    - **Проблема:** Enums и опции дублируются:
      - `apps/dashboard/src/features/ingest/StartIngestForm.tsx:24-32`
      - `apps/dashboard/src/app/hwar/create/new/page.tsx:20-27`
    - **Решение:** Вынести в `packages/shared-types`

14. **Отсутствует rate limiting UI feedback**
    - **Проблема:** В `package.json` есть `@upstash/ratelimit`, но нет UI индикатора если пользователь превысил лимит
    - **Риск:** Пользователь не поймёт почему действие не выполнилось

15. **Нет offline support**
    - **Проблема:** Приложение не работает без интернета (нет service worker, нет offline fallback)
    - **Риск:** Плохой UX на мобильных устройствах

---

## 7. Приложения

### A. Пути к ключевым файлам

#### Navigation Configs

- **Main Header:** `apps/dashboard/src/shared/components/layout/header.tsx` (lines 10-16)
- **HWAR Sidebar:** `apps/dashboard/src/app/hwar/layout.tsx` (lines 6-13)
- **Factory Sidebar:** `apps/dashboard/src/features/hwar-factory/components/factory-sidebar.tsx` (lines 16-39)
- **Library Sidebar:** `apps/dashboard/src/features/hwar-factory/components/library-sidebar.tsx` (lines 13-18)

#### Actions

- **Actions API Client:** `apps/dashboard/src/shared/api/actions.ts`
- **Action Runner Endpoint:** `apps/dashboard/src/app/api/actions/route.ts`

#### Forms

- **Start Ingest Form:** `apps/dashboard/src/features/ingest/StartIngestForm.tsx`
- **HBAR Create New Project:** `apps/dashboard/src/app/hwar/create/new/page.tsx`
- **Project Detail:** `apps/dashboard/src/app/hwar/create/[project_id]/page.tsx`

#### API Routes

- **Videos API:** `apps/dashboard/src/app/api/videos/route.ts`
- **Trends API:** `apps/dashboard/src/app/api/analytics/trends/route.ts`
- **Projects API (GET):** `apps/dashboard/src/app/api/generation/projects/[project_id]/route.ts`
- **Assets API (GET):** `apps/dashboard/src/app/api/generation/projects/[project_id]/assets/route.ts`
- **R2 Upload URL:** `apps/dashboard/src/app/api/r2/upload-url/route.ts`
- **R2 Download URL:** `apps/dashboard/src/app/api/r2/download-url/route.ts`
- **HALU Webhook:** `apps/dashboard/src/app/api/webhooks/halu/route.ts`

### B. Константы роутинга (отсутствуют)

**Рекомендация:** Создать `apps/dashboard/src/shared/constants/routes.ts`:

```typescript
export const ROUTES = {
  HOME: '/',
  INGEST: '/ingest',
  ANALYSIS: '/analysis',
  GENERATION: '/generation',
  HWAR: {
    INDEX: '/hwar',
    CREATE: {
      INDEX: '/hwar/create',
      NEW: '/hwar/create/new',
      PROJECT: (id: string) => `/hwar/create/${id}`,
    },
    FACTORY: {
      INDEX: '/hwar/factory',
      HARVESTS: '/hwar/factory/harvests',
      ANALYSIS: '/hwar/factory/analysis',
      QUEUES: '/hwar/factory/queues',
      WORKERS: '/hwar/factory/workers',
      BATCHES: '/hwar/factory/batches',
      ANALYTICS: '/hwar/factory/analytics',
      SETTINGS: '/hwar/factory/settings',
    },
    LIBRARY: {
      INDEX: '/hwar/library',
      PRESETS: '/hwar/library/presets',
      CHARACTERS: '/hwar/library/characters',
      DATASETS: '/hwar/library/datasets',
      TEMPLATES: '/hwar/library/templates',
    },
  },
} as const;
```

### C. i18n Namespace Mapping (отсутствует)

**Рекомендация:** Если добавить i18n (например, next-intl), структура может быть:

```
apps/dashboard/src/i18n/
├── en/
│   ├── common.json
│   ├── ingest.json
│   ├── analysis.json
│   ├── generation.json
│   └── hwar.json
└── ru/
    ├── common.json
    ├── ingest.json
    ├── analysis.json
    ├── generation.json
    └── hwar.json
```

---

## 8. Итоговая сводка

### Статистика

- **Всего маршрутов:** 33 (24 page routes + 9 API routes)
- **Экраны с формами:** 7
- **Экраны без форм:** 17
- **Server Actions:** 14 (зарегистрированных в `actions.ts`)
- **API Route Handlers:** 9
- **Основные разделы:** 5 (Home, Ingest, Analyze, Generate, HWAR)
- **HWAR подразделы:** 3 (Create, Factory, Library)
- **Отсутствующие loading.tsx:** 33 (все)
- **Отсутствующие error.tsx:** 33 (все)

### HBAR Create воронка (детально)

1. `/hwar/create` → Projects List → "New Project" button
2. `/hwar/create/new` Step 1 → Project Details (title, ratio, lang)
3. `/hwar/create/new` Step 2 → Content Source (Prompt | Presets | Trends)
4. `/hwar/create/new` Step 3 → Review & Generate → `generation.startProject` action
5. Redirect to `/hwar/create/[project_id]`
6. Project Detail → Select Scenario → `generation.generateKeyframes` action
7. Keyframe generation (polling assets every 3s)
8. Display First & Last frames for each scene
9. **Next (TODO):** Animation → `generation.startAnimation` action

### Критичные задачи для закрытия пробелов

1. ✅ Реализовать Action Runner handlers (`apps/dashboard/src/app/api/actions/route.ts`)
2. ✅ Реализовать Projects API (`GET /api/generation/projects`)
3. ✅ Добавить loading.tsx для ключевых страниц (минимум для `/hwar/create/new`, `/hwar/create/[project_id]`, `/analysis`)
4. ✅ Добавить error.tsx для обработки ошибок (минимум root level)
5. ✅ Реализовать AI scenarios generation (в рамках `generation.startProject` action)
6. ⚠️ Добавить server-side валидацию для всех API endpoints
7. ⚠️ Добавить middleware для auth проверки
8. ⚠️ Проверить и задокументировать Factory/Library страницы
9. ⚠️ Создать константы роутинга (`ROUTES`)
10. ⚠️ Добавить retry mechanism для failed keyframe generation

---

**Конец отчёта UI_MAP.md**
