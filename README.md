# Scrimspec 🎬

**Scrimspec** — система анализа и генерации коротких видео на основе эмоциональной архитектуры (AES).

## 📦 Монорепо структура

```
scrimspec/
├── apps/
│   └── dashboard/          ← Next.js UI приложение
├── packages/
│   ├── orchestrator/       ← MiniMax API backend (TypeScript)
│   ├── db/                 ← Drizzle ORM слой
│   └── shared-types/       ← Общие TypeScript типы
└── tools/
    └── yt-orchestrator-python/  ← Python аналитика (YouTube, Gemini)
```

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- pnpm 8+
- PostgreSQL / Supabase (опционально)

### Установка

```bash
# Установить зависимости всех пакетов
pnpm install

# Собрать все пакеты
pnpm build

# Запустить dev-сервер
pnpm dev
```

### Основные команды

| Command | Description |
|---------|-------------|
| `pnpm dev` | Запустить все приложения в режиме разработки |
| `pnpm build` | Собрать все пакеты |
| `pnpm lint` | Проверить код (ESLint) |
| `pnpm format` | Отформатировать код (Prettier) |
| `pnpm type-check` | Проверить типы (TypeScript) |
| `pnpm test` | Запустить тесты |
| `pnpm clean` | Очистить всех build артефакты |

## 📁 Пакеты

### `packages/shared-types`
Центральное хранилище всех TypeScript интерфейсов и типов.

- `Task`, `TaskStatus`, `TaskKind`
- `VideoRequest`, `ImageRequest`, `AudioRequest`
- Типы для Drizzle ORM
- Конфиги и утилиты

```typescript
import { Task, TextToVideoRequest } from '@scrimspec/shared-types';
```

### `packages/db`
Drizzle ORM слой для работы с PostgreSQL/Supabase.

**Таблицы:**
- `tasks` — история всех генераций
- `clips` — кадры видео
- `batches` — пакеты обработки
- `assets` — кэш изображений и видео

```typescript
import { getDrizzleClient, schema } from '@scrimspec/db';
import { createTask, getTaskById } from '@scrimspec/db/queries';

const db = getDrizzleClient();
const task = await createTask(db, { id: '123', kind: 't2v', status: 'processing' });
```

### `packages/orchestrator`
Backend на Express + MiniMax API. Основной сервис генерации видео.

**Endpoints:**
- `POST /api/generate-text-video` — Text-to-Video
- `POST /api/generate-image-video` — Image-to-Video
- `POST /api/generate-image` — Text-to-Image
- `POST /api/t2a_async_v2` — Text-to-Audio
- `POST /api/voice-clone` — Voice cloning
- Более 18 endpoints...

```bash
cd packages/orchestrator
pnpm dev  # Запустить на http://localhost:8000
```

### `apps/dashboard`
Next.js UI для управления генерациями и просмотра истории.

```bash
cd apps/dashboard
pnpm dev  # Запустить на http://localhost:3000
```

### `tools/yt-orchestrator-python`
Python скрипты для аналитики видео и сбора данных из YouTube.

```bash
cd tools/yt-orchestrator-python
python collect_all_videos_from_channels.py
python build_frames_dataset.py
```

## 🔧 Конфигурация

### Переменные окружения

Создать `.env` в корне (скопировать из `.env.example`):

```env
# MiniMax API
MINIMAX_API_KEY=sk-your-key-here
PUBLIC_BASE_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:password@localhost/scrimspec
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
SUPABASE_ANON_KEY=your-anon-key

# Server
PORT=8000
NODE_ENV=development
```

## 📚 Документация

- [Architecture Guide](./docs/ARCHITECTURE.md) — Архитектура проекта
- [API Documentation](./packages/orchestrator/README.md) — API endpoints
- [Database Schema](./packages/db/README.md) — Структура БД
- [Type Definitions](./packages/shared-types/src/index.ts) — Все типы

## 🏗️ Архитектура

```
User Request
    ↓
Next.js Dashboard (apps/dashboard)
    ↓
Express API (packages/orchestrator)
    ↓
Drizzle ORM (packages/db)
    ↓
PostgreSQL / Supabase
    ↓
MiniMax API (video/image/audio generation)
    ↓
Result stored in DB & filesystem
```

### Data Flow

1. **Frontend запрос** → Next.js dashboard отправляет запрос на API
2. **API endpoint** → Express парсит, валидирует, отправляет в MiniMax
3. **Async processing** → MiniMax обрабатывает, MiniMax вызывает webhook callback
4. **Database storage** → Drizzle сохраняет статус и URL видео
5. **Frontend polling** → Dashboard опрашивает `/api/job/:task_id` и показывает результат

## 🔐 Security

- ✅ CORS allowlist
- ✅ Helmet security headers
- ✅ Content-Security-Policy (CSP)
- ✅ Rate limiting (60 req/min на /api)
- ✅ Input validation
- ✅ MiniMax webhook callback verification (challenge mechanism)

## 📊 Development Tools

- **TypeScript** — Type-safe development
- **ESLint** — Code quality
- **Prettier** — Code formatting
- **Turbo** — Build orchestration & caching
- **Drizzle Kit** — Database migrations

## 🚢 Deployment

### Production checklist

- [ ] Установить TypeScript зависимости
- [ ] Запустить `pnpm build`
- [ ] Установить environment variables
- [ ] Мигрировать БД: `cd packages/db && pnpm migrate`
- [ ] Запустить: `node packages/orchestrator/dist/src/server.js`

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
EXPOSE 8000
CMD ["node", "packages/orchestrator/dist/src/server.js"]
```

## 🤝 Contributing

1. Fork and clone
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT

## 📧 Support

Для вопросов и поддержки создайте issue в репозитории.

---

**Версия:** 0.1.0
**Статус:** Early Development 🚧
