# Database Quick Reference - ScrimSpec

Быстрая справка по новым возможностям БД после оптимизации.

---

## 🔥 Топ-3 функции для разработки

### 1. Получить data-driven промпт для LLM
```sql
SELECT build_llm_system_prompt('rescue dog', 'short');
```

### 2. Автоскоринг сценария
```sql
SELECT auto_score_scenario('{"duration_s": 30, "beats": [...]}');
```

### 3. Найти похожие успешные видео
```sql
SELECT * FROM find_similar_videos('rescue', 30, 5);
```

---

## 📊 Мониторинг и статистика

### Проверить здоровье БД
```sql
-- Все cron задания
SELECT * FROM v_cron_jobs;

-- Статистика materialized views
SELECT * FROM get_materialized_view_stats();

-- Текущие рекомендации для генерации
SELECT * FROM v_generation_recommendations;

-- Последние события аудита
SELECT * FROM v_audit_log_recent LIMIT 10;
```

### Проверить индексы
```sql
-- Зависимости индексов (какие защищены FK)
SELECT * FROM v_index_dependencies;

-- Неиспользуемые индексы
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 🔄 Ручное обновление данных

### Обновить аналитику немедленно
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_patterns;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_youtube_engagement;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_batch_performance;
```

### Очистить старые данные
```sql
-- Удалить audit logs старше 90 дней
SELECT clean_old_audit_logs('90 days');

-- Очистить soft-deleted записи (30+ дней)
SELECT purge_old_deleted_records('30 days');
```

---

## 📈 Полезные вьюхи

### Активные задачи и очереди
```sql
SELECT * FROM v_active_tasks;
SELECT * FROM v_pending_queue_items;
SELECT * FROM v_queue_health;
```

### Прогресс батчей
```sql
SELECT * FROM v_batch_progress WHERE status = 'running';
```

### YouTube аналитика
```sql
SELECT * FROM v_youtube_videos_with_analysis
WHERE engagement_rate > 3.0
ORDER BY engagement_rate DESC;
```

### Генерация видео
```sql
SELECT * FROM v_generation_pipeline_full
WHERE status = 'done'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🛠️ Полезные функции

### Legacy ID маппинг (для миграции)
```sql
SELECT get_uuid_by_legacy_id('tasks', 'old-text-id');
SELECT get_legacy_id_by_uuid('tasks', 'uuid-here');
```

### Soft delete / restore
```sql
SELECT soft_delete_record('tasks', task_uuid);
SELECT restore_deleted_record('tasks', task_uuid);
```

### История изменений
```sql
SELECT * FROM get_audit_history('tasks', task_uuid);
```

---

## 🐍 Python примеры

### Базовая настройка
```python
from supabase import create_client

supabase = create_client(
    "https://xxx.supabase.co",
    "your-anon-key"
)
```

### Получить промпт для LLM
```python
result = supabase.rpc('build_llm_system_prompt', {
    'p_topic': 'rescue dog story',
    'p_duration_category': 'short'
}).execute()

system_prompt = result.data
```

### Автоскоринг
```python
scores = supabase.rpc('auto_score_scenario', {
    'p_scenario': {
        "duration_s": 30,
        "beats": [
            {"name": "intro", "start_s": 0, "end_s": 3},
            {"name": "build", "start_s": 3, "end_s": 12},
            {"name": "peak", "start_s": 12, "end_s": 20},
            {"name": "payoff", "start_s": 20, "end_s": 28}
        ],
        "emotional_tags": ["rescue", "tears"]
    }
}).execute()

print(scores.data['overall'])  # 0.886
```

### Найти похожие видео
```python
similar = supabase.rpc('find_similar_videos', {
    'p_topic': 'rescue',
    'p_duration_s': 30,
    'p_limit': 5
}).execute()

for video in similar.data:
    print(f"{video['title']} - {video['engagement_rate']}%")
```

---

## 📦 TypeScript / JavaScript примеры

### Базовая настройка
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://xxx.supabase.co',
  'your-anon-key'
)
```

### Получить топ-паттерны
```typescript
const { data: patterns } = await supabase
  .rpc('get_top_patterns_for_llm')

console.log(`Based on ${patterns.sample_size} videos`)
console.log(`Optimal duration: ${patterns.typical_duration_s}s`)
```

### Dashboard рекомендации
```typescript
const { data: recommendations } = await supabase
  .from('v_generation_recommendations')
  .select('*')
  .single()

// Use in UI
<RecommendationsCard data={recommendations} />
```

### Мониторинг cron jobs
```typescript
const { data: jobs } = await supabase
  .from('v_cron_jobs')
  .select('*')
  .eq('active', true)

jobs.forEach(job => {
  console.log(`${job.jobname}: ${job.schedule}`)
})
```

---

## 🔐 Безопасность

### Все views теперь SECURITY INVOKER ✅
Это значит views уважают RLS политики пользователя.

### RLS политики оптимизированы ✅
Используют `(SELECT auth.uid())` для производительности.

### Проверить RLS
```sql
-- Проверить включен ли RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Посмотреть политики
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## ⏰ Автоматические задания (pg_cron)

| Задание | Когда | Что делает |
|---------|-------|------------|
| `refresh-analytics-views` | Каждые 6ч | Обновляет все materialized views |
| `clean-old-audit-logs` | Вс 2:00 | Удаляет логи старше 90 дней |
| `purge-old-deleted-records` | 1-е число 3:00 | Очищает soft-deleted записи |
| `vacuum-analyze-tables` | Вс 4:00 | Оптимизирует производительность |

---

## 📖 JSON Schema валидация

### Доступные схемы
```sql
SELECT schema_name, description
FROM json_schemas
ORDER BY schema_name;
```

Схемы:
- `ingest_queue_metadata` - для metadata в ingest_queue
- `analysis_queue_metadata` - для metadata в analysis_queue
- `video_analysis_metadata` - для metadata в video_analysis
- `generation_asset_metadata` - для metadata в assets
- `generation_short_metadata` - для metadata в shorts
- `task_params` - для params в tasks

### Получить схему
```sql
SELECT get_metadata_schema('ingest_queue_metadata');
```

---

## 🔍 Troubleshooting

### Materialized view пустая
```sql
-- Проверить есть ли данные
SELECT COUNT(*) FROM video_analysis
WHERE (metadata->'scores'->>'overall')::float > 0.7;

-- Если мало данных, понизить порог или добавить больше анализов
```

### Функция возвращает NULL
```sql
-- Проверить что mv_top_patterns имеет данные
SELECT * FROM mv_top_patterns;

-- Если пусто, обновить
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_patterns;
```

### Cron job не выполняется
```sql
-- Проверить статус
SELECT * FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job)
ORDER BY start_time DESC
LIMIT 10;

-- Посмотреть ошибки
SELECT jobid, start_time, status, return_message
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC;
```

---

## 📚 Полная документация

- **Подробный отчёт:** `DATABASE_OPTIMIZATION_SUMMARY.md`
- **LLM интеграция:** `LLM_INTEGRATION_GUIDE.md`
- **YouTube инжест:** `youtube/README.md`
- **Dashboard:** `dashboard/README.md`

---

## 🎯 Быстрый чеклист

После деплоя проверить:

- [ ] `SELECT * FROM v_cron_jobs` - все 4 задания active
- [ ] `SELECT * FROM get_materialized_view_stats()` - все views обновлены
- [ ] `SELECT get_top_patterns_for_llm()` - возвращает данные
- [ ] `SELECT * FROM v_index_dependencies` - нет неожиданных зависимостей
- [ ] `SELECT COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '1 hour'` - логирование работает

---

**Дата создания:** 2025-10-24
**Версия БД:** 34 migrations applied
