# Architecture Guide 🏗️

## Overview

**Scrimspec** — это монорепо для системы анализа и генерации видео на основе эмоциональной архитектуры (AES).

### Core Principles

1. **Monorepo with Workspaces** — Единая управляемая структура с pnpm
2. **Type Safety First** — TypeScript везде, shared types как SSOT
3. **Database as Source of Truth** — PostgreSQL/Supabase для всех данных
4. **Separation of Concerns** — Python для анализа, TypeScript для оркестрации
5. **Scalable Architecture** — Drizzle ORM, Express routes modules, React components

---

## 📦 Package Structure

### `packages/shared-types` ⭐
**Single Source of Truth для типов**

```
src/
├── index.ts              ← Экспортирует все типы
├── Task types            ← Task, TaskStatus, TaskKind
├── Request types         ← Video/Image/Audio requests
├── Response types        ← API responses
├── Database types        ← Drizzle models
└── Config types          ← Server, API, Database config
```

**Используется в:**
- `packages/db` — Drizzle schema типы
- `packages/orchestrator` — API request/response типы
- `apps/dashboard` — Frontend типы

**Пример:**
```typescript
export interface Task {
  id: string;
  kind: TaskKind;  // 't2v' | 'i2v' | 't2i' | 'tts' | ...
  status: TaskStatus;  // 'queued' | 'processing' | 'success' | 'failed'
  prompt?: string;
  params?: Record<string, unknown>;
  fileId?: string;
  publicUrl?: string;
  startedAt: Date;
  finishedAt?: Date;
}
```

### `packages/db` 🗄️
**Drizzle ORM для PostgreSQL/Supabase**

```
src/
├── schema/
│   ├── tasks.ts          ← Tasks таблица + типы
│   ├── clips.ts          ← Clips (видео кадры)
│   ├── batches.ts        ← Batch операции
│   ├── assets.ts         ← Кэш изображений/видео
│   └── index.ts          ← Экспорт всех таблиц
├── client.ts             ← Drizzle client factory
├── queries/
│   ├── tasks.ts          ← CRUD функции для tasks
│   └── index.ts          ← Экспорт всех queries
└── index.ts              ← Главный экспорт
```

**Использование:**
```typescript
import { getDrizzleClient } from '@scrimspec/db';
import { createTask, getTaskById } from '@scrimspec/db/queries';

const db = getDrizzleClient();
const task = await createTask(db, {
  id: 'task-123',
  kind: 't2v',
  status: 'processing',
  prompt: 'A beautiful sunset',
  startedAt: new Date(),
});
```

**Таблицы:**

| Table | Purpose | Indexes |
|-------|---------|---------|
| `tasks` | История всех генераций | status, batch_id |
| `clips` | Видео-кадры внутри tasks | task_id |
| `batches` | Групповая обработка | status |
| `assets` | Кэш результатов | prompt, kind |

### `packages/orchestrator` 🎬
**Express + MiniMax API Backend**

```
src/
├── config/
│   └── index.ts          ← Env variables & config
├── db/
│   ├── client.js → .ts   ← (будет мигрировано)
│   └── tasks.js → .ts    ← (будет мигрировано)
├── middleware/
│   ├── security.ts       ← CORS, Helmet, CSP, Rate limiting
│   └── errorHandler.ts   ← Global error handling
├── lib/
│   ├── logger.ts         ← Pino logger
│   └── minimax.ts        ← MiniMax API client (будет)
├── routes/ (новое)
│   ├── video.ts          ← T2V, I2V, StartEnd endpoints
│   ├── image.ts          ← T2I endpoint
│   ├── audio.ts          ← TTS, Voice clone
│   ├── files.ts          ← Upload, retrieval
│   ├── jobs.ts           ← Job polling
│   └── health.ts         ← Health checks
├── services/ (новое)
│   ├── minimax.ts        ← API calls to MiniMax
│   ├── fileHandler.ts    ← Download, archive videos
│   └── validator.ts      ← Input validation
└── server.ts             ← Express app setup (будет мигрировано)
```

**18 Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/healthz` | Health check |
| POST | `/api/generate-text-video` | Text-to-Video |
| POST | `/api/generate-image-video` | Image-to-Video |
| POST | `/api/generate-start-end-video` | Start+End frames |
| POST | `/api/generate-image` | Text-to-Image |
| POST | `/api/t2a_v2` | TTS (sync) |
| POST | `/api/t2a_async_v2` | TTS (async) |
| POST | `/api/voice-clone` | Voice cloning |
| POST | `/api/video-template` | Template generation |
| GET | `/api/video-template/status` | Template status |
| POST | `/api/compose` | Compose clips + audio |
| POST | `/api/upload` | File upload |
| GET | `/api/file/:file_id` | Get file info |
| GET | `/api/job/:task_id` | Poll job status |
| POST | `/hailuo/callback` | MiniMax webhook |
| + 4 Demo endpoints | `/demo/*` | Demo examples |

**Architecture:**

```
Express App
├── Security Layer (CORS, Helmet, CSP, Rate limiting)
├── Routes (18 endpoints)
│   ├── /video
│   ├── /image
│   ├── /audio
│   ├── /jobs
│   └── /files
├── Services (business logic)
│   ├── MiniMax API client
│   ├── File handler
│   └── Validator
├── Middleware (error, logging)
└── Database (Drizzle + Supabase)
```

### `apps/dashboard` 📊
**Next.js UI для управления генерациями**

```
app/
├── layout.tsx            ← Root layout + navigation
├── page.tsx              ← Home page
├── (routes)/
│   ├── video/            ← T2V, I2V pages
│   ├── image/            ← T2I page
│   ├── audio/            ← TTS, Voice clone
│   ├── templates/        ← Template browser
│   ├── history/          ← Task history
│   └── shorts/           ← Shorts generator
├── components/           ← Reusable components
├── hooks/                ← Custom hooks
├── lib/
│   └── api.ts            ← API client with shared types
├── types/                ← Re-export from shared-types
└── styles/               ← Tailwind CSS
```

**Features:**
- Real-time polling for async tasks
- Task history with filtering
- Video/image preview
- Responsive design
- Type-safe API calls (using @scrimspec/shared-types)

### `tools/yt-orchestrator-python` 🐍
**Python скрипты для аналитики видео**

```
├── collect_all_videos_from_channels.py
│   └── Собирает видео из YouTube каналов
├── build_frames_dataset.py
│   └── Создает датасет кадров для анализа
├── channels.csv          ← Список каналов
├── requirements.txt      ← Python зависимости
└── README.md
```

**Использование:**
```bash
pip install -r requirements.txt
python collect_all_videos_from_channels.py
python build_frames_dataset.py
```

**Интеграция с TypeScript:**
- Результаты сохраняются в PostgreSQL (через `packages/db`)
- Данные используются в `packages/orchestrator` для обогащения видео-метаданных
- Analytics доступны в `apps/dashboard`

---

## 🔄 Data Flow

### Video Generation Pipeline

```
1. Frontend (Dashboard)
   ↓
2. POST /api/generate-text-video { prompt, duration, ... }
   ↓
3. Express API
   ├─ Validate request
   ├─ Save task to DB (status: 'queued')
   ├─ Call MiniMax API
   └─ Return task_id to client
   ↓
4. MiniMax Processing (async)
   ├─ Generate video
   ├─ Upload to file storage
   └─ Call POST /hailuo/callback { task_id, file_id, ... }
   ↓
5. Callback Handler
   ├─ Verify webhook signature
   ├─ Download video from MiniMax
   ├─ Save to ./archive
   ├─ Update DB (status: 'success', public_url)
   └─ Log completion
   ↓
6. Frontend Polling
   ├─ Poll GET /api/job/:task_id every 2 seconds
   ├─ Receive status + public_url
   └─ Display video in player
```

### Database Schema

```sql
-- tasks: все запросы на генерацию
task_id (PK) | kind | status | prompt | params | file_id | public_url | ...

-- clips: видео-кадры
id (PK) | task_id (FK) | beat_id | public_url | duration_s

-- batches: групповая обработка
id (PK) | status | total | ok | fail | avg_time_ms

-- assets: кэш результатов
id (PK) | kind | prompt | aspect_ratio | url
```

---

## 🔑 Key Files

### Shared Types (Single Source of Truth)

📄 **`packages/shared-types/src/index.ts`** (500+ lines)

Contains:
- `Task`, `TaskStatus`, `TaskKind`
- All request interfaces (T2V, I2V, T2I, TTS, VoiceClone, etc.)
- All response interfaces
- Database types for Drizzle
- Server/API/Database configs

**Every new feature** должна добавлять тип сюда перед реализацией в backend/frontend!

### Drizzle ORM Schema

📄 **`packages/db/src/schema/index.ts`** (Drizzle models)

```typescript
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  kind: text('kind').$type<TaskKind>().notNull(),
  status: text('status').$type<TaskStatus>().notNull(),
  // ...
});

// Drizzle automatically generates types:
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

### API Client

📄 **`packages/orchestrator/src/server.ts`** (будет мигрировано)

```typescript
// Все endpoints типизированы с shared-types:
app.post('/api/generate-text-video', async (req, res) => {
  const { prompt, duration } = req.body as TextToVideoRequest;
  const response: APIResponse<JobStatusResponse> = { ... };
  res.json(response);
});
```

### Frontend API Integration

📄 **`apps/dashboard/lib/api.ts`** (type-safe API client)

```typescript
import type { TextToVideoRequest, JobStatusResponse } from '@scrimspec/shared-types';

export async function generateTextToVideo(req: TextToVideoRequest) {
  const response = await fetch('/api/generate-text-video', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return response.json() as Promise<APIResponse<JobStatusResponse>>;
}
```

---

## 🛠️ Development Workflow

### Adding a New Feature

1. **Define types** in `packages/shared-types/src/index.ts`
   ```typescript
   export interface MyNewRequest { ... }
   export interface MyNewResponse { ... }
   ```

2. **Add database support** in `packages/db/src/schema/`
   ```typescript
   export const myTable = pgTable('my_table', { ... });
   ```

3. **Add query helpers** in `packages/db/src/queries/`
   ```typescript
   export async function createMyRecord(db: DB, data: NewMyRecord) { ... }
   ```

4. **Add API endpoint** in `packages/orchestrator/src/routes/`
   ```typescript
   router.post('/api/my-endpoint', async (req, res) => {
     const body = req.body as MyNewRequest;
     // ...
   });
   ```

5. **Add UI** in `apps/dashboard/app/`
   ```typescript
   import type { MyNewRequest } from '@scrimspec/shared-types';

   export default function MyPage() { ... }
   ```

### Build & Test

```bash
# Build all packages
pnpm build

# Type check
pnpm type-check

# Run tests
pnpm test

# Format code
pnpm format
```

---

## 🔐 Security

### CORS
- Allowlist by origin (env: `CORS_ORIGIN`)
- Whitelist specific domains in production

### Helmet
- Automatic security headers
- CSP (Content-Security-Policy)
- No framing, clickjacking protection

### Rate Limiting
- `/api/*` — 60 req/min per IP
- `/demo/*` — 10 req/min per IP

### Input Validation
- Request body schemas
- Parameter type checking
- MiniMax API validation

### MiniMax Callback Verification
- Challenge mechanism for webhook authenticity
- Signature verification (when available)

---

## 📊 Monitoring & Logging

### Logging
- Pino JSON logger in orchestrator
- Structured logs for debugging
- Request/response logging middleware

### Metrics (Future)
- Task completion rates
- Average generation time
- API quota usage
- Error rates

### Database Monitoring
- Query performance indexes
- Slow query logs
- Connection pool stats

---

## 🚀 Performance Optimization

### Current

- ✅ Database indexes on frequently queried columns
- ✅ In-memory job cache (PostgreSQL fallback)
- ✅ Rate limiting to prevent abuse
- ✅ Static file caching (./out, ./archive)

### Future

- Implement Redis for distributed caching
- Add query result caching (Drizzle + Cacheability)
- WebSocket for real-time updates (vs polling)
- CDN for video delivery
- Batch processing optimization

---

## 📚 Dependencies

### Root (Monorepo)

```json
{
  "typescript": "^5.3.3",
  "turbo": "^2.0.0",
  "prettier": "^3.1.0",
  "eslint": "^8.55.0"
}
```

### Core Packages

| Package | Key Dependencies |
|---------|-------------------|
| `shared-types` | typescript |
| `db` | drizzle-orm, pg, @supabase/supabase-js |
| `orchestrator` | express, cors, helmet, pino |
| `dashboard` | next, react, @tanstack/react-query |

---

## 🔗 Cross-Package Communication

```
shared-types (exports types)
     ↑
     ├─→ db (uses for Drizzle schemas)
     ├─→ orchestrator (uses for API types)
     └─→ dashboard (uses for form/response types)

db (exports queries)
     ↑
     └─→ orchestrator (uses in routes)

orchestrator (API)
     ←
     └─ dashboard (fetches data)

yt-orchestrator-python (data collection)
     ↓
     saves to → PostgreSQL (via db queries)
```

---

## 📖 Best Practices

### TypeScript

- ✅ Strict mode enabled
- ✅ No `any` types (use proper interfaces)
- ✅ Define types first, implement later
- ✅ Re-export shared types from `@scrimspec/shared-types`

### Code Organization

- ✅ Routes in separate modules
- ✅ Services for business logic
- ✅ Middleware for cross-cutting concerns
- ✅ Types in shared-types package

### Database

- ✅ Use Drizzle ORM queries instead of raw SQL
- ✅ Add indexes for frequently filtered columns
- ✅ Use transactions for multi-step operations
- ✅ Implement soft deletes if needed

### Frontend

- ✅ Use React hooks from shared-types
- ✅ Separate components for reusability
- ✅ Use TypeScript for form values
- ✅ Implement error boundaries

---

## 🎯 Next Steps

1. **TypeScript Migration** (orchestrator: .js → .ts)
2. **Tests** (unit, integration, e2e)
3. **API Documentation** (OpenAPI/Swagger)
4. **CI/CD** (GitHub Actions)
5. **Monitoring** (Sentry, Prometheus)
6. **Docker** (Dockerfile, docker-compose)

---

Version: 0.1.0
Status: Early Development 🚧
