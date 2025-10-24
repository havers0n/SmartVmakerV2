# 🗄️ Database Setup Instructions

## Быстрый старт

Используй Supabase SQL Editor для запуска миграций и добавления тестовых данных.

### Шаг 1: Откройте Supabase SQL Editor

1. Зайди на https://supabase.com/dashboard
2. Выбери свой проект `scrimspec`
3. Перейди в раздел **SQL Editor**
4. Нажми **+ New Query**

### Шаг 2: Запусти миграции

Скопируй содержимое файла:
```
packages/db/migrations/0000_medical_nicolaos.sql
```

И вставь его в SQL Editor, затем нажми **RUN** (или Ctrl+Enter).

Это создаст все нужные таблицы:
- `youtube_videos` - YouTube видео которые были загружены через Ingest
- `video_analysis` - Результаты анализа видео
- `analysis_queue` - Задания на анализ видео
- `ingest_queue` - Задания на поиск видео
- И другие таблицы для генерации...

### Шаг 3: Добавь тестовые данные (опционально)

Для тестирования UI можешь добавить пример видео. Скопируй содержимое:
```
packages/db/seed.sql
```

И выполни в SQL Editor.

Это добавит 5 тестовых видео о животных.

### Шаг 4: Проверь результат

После выполнения SQL, перейди на страницу **Analyze Videos** в dashboard:
```
http://localhost:3004/analysis
```

Там должны появиться видео из таблицы `youtube_videos`.

---

## 📊 Структура таблиц

### `youtube_videos`
Таблица с метаданными YouTube видео:
```sql
- id (TEXT, PRIMARY KEY) - YouTube video ID
- url (TEXT) - Ссылка на видео
- title (TEXT) - Название видео
- description (TEXT) - Описание
- published_at (TIMESTAMP) - Дата публикации
- channel_title (TEXT) - Название канала
- duration_seconds (INTEGER) - Длительность в секундах
- view_count (BIGINT) - Количество просмотров
- like_count (BIGINT) - Количество лайков
- comment_count (BIGINT) - Количество комментариев
- tags (JSONB) - Теги (JSON array)
- created_at (TIMESTAMP) - Когда запись была создана
- updated_at (TIMESTAMP) - Когда запись была обновлена
```

### `ingest_queue`
Таблица с заданиями на поиск видео:
```sql
- id (UUID, PRIMARY KEY)
- query (TEXT) - Поисковый запрос
- status (TEXT) - pending, processing, done, failed
- published_after (TIMESTAMP) - Фильтр по дате
- duration (TEXT) - short, medium, long
- error (TEXT) - Сообщение об ошибке если failed
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### `analysis_queue`
Таблица с заданиями на анализ видео:
```sql
- id (UUID, PRIMARY KEY)
- video_id (TEXT) - ID видео для анализа
- analyzer (TEXT) - gemini, nanobanana, etc.
- status (TEXT) - pending, processing, done, failed
- error (TEXT) - Сообщение об ошибке если failed
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### `video_analysis`
Результаты анализа видео:
```sql
- id (UUID, PRIMARY KEY)
- video_id (TEXT) - ID проанализированного видео
- analyzer (TEXT) - Какой анализатор использовался
- analysis_url (TEXT) - URL на JSON с результатами анализа
- metadata (JSONB) - Дополнительные метаданные
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

---

## 🔗 Связи между таблицами

```
┌─────────────────────┐
│  ingest_queue       │ ──> поиск видео на YouTube
│                     │
│  query: "pets"      │
│  status: pending    │
└─────────────────────┘
         ▼
┌─────────────────────┐
│  youtube_videos     │ ──> загруженные видео
│                     │
│  id: video_12345    │
│  title: "..."       │
└─────────────────────┘
         ▼
┌─────────────────────┐
│  analysis_queue     │ ──> задания на анализ
│                     │
│  video_id: 12345    │
│  analyzer: gemini   │
└─────────────────────┘
         ▼
┌─────────────────────┐
│  video_analysis     │ ──> результаты анализа
│                     │
│  video_id: 12345    │
│  metadata: {...}    │
└─────────────────────┘
```

---

## ⚙️ Переменные окружения

Убедись что в `.env` файле установлены:

```
DATABASE_URL=postgresql://postgres:PASSWORD@db.cuwdjemjuszaaxpouprc.supabase.co:5432/postgres
SUPABASE_URL=https://cuwdjemjuszaaxpouprc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## 🚀 Для разработки

Когда будешь разрабатывать новые фичи:

1. Обнови схему в `packages/db/src/schema/*.ts`
2. Сгенерируй новые миграции:
   ```bash
   cd packages/db
   pnpm run generate
   ```
3. Выполни миграции в Supabase SQL Editor

---

## 📝 Полезные SQL запросы

### Посмотреть все видео:
```sql
SELECT id, title, channel_title, view_count, created_at
FROM youtube_videos
ORDER BY created_at DESC;
```

### Посмотреть задания на анализ:
```sql
SELECT v.title, aq.analyzer, aq.status, aq.created_at
FROM analysis_queue aq
JOIN youtube_videos v ON v.id = aq.video_id
ORDER BY aq.created_at DESC;
```

### Посмотреть результаты анализа:
```sql
SELECT v.title, va.analyzer, va.metadata
FROM video_analysis va
JOIN youtube_videos v ON v.id = va.video_id;
```

### Удалить все тестовые видео:
```sql
DELETE FROM youtube_videos WHERE id LIKE '%test%';
```
