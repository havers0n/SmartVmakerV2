# LLM Integration Guide - Data-Driven Video Generation

Это руководство показывает, как использовать аналитику из базы данных для улучшения генерации видео с помощью LLM.

---

## 🎯 Концепция

Вместо статических промптов мы используем **data-driven подход**:
1. Анализируем топ-перформеры (video_analysis)
2. Извлекаем успешные паттерны (mv_top_patterns)
3. Передаём LLM актуальные бенчмарки
4. Автоматически скорим результаты

---

## 📊 Доступные функции

### 1. `build_llm_system_prompt(topic, duration_category)`

**Цель:** Создать системный промпт с актуальными данными из топ-видео

**Параметры:**
- `topic` (text, optional) - тема видео, например "rescue dog"
- `duration_category` (text) - 'short' (30s), 'medium' (60s), 'long' (90s)

**Возвращает:** text - готовый системный промпт

**Пример использования:**

```python
# Python + Supabase
from supabase import create_client
import anthropic

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

# Получить data-driven системный промпт
prompt_result = supabase.rpc('build_llm_system_prompt', {
    'p_topic': 'rescue dog emotional story',
    'p_duration_category': 'short'
}).execute()

system_prompt = prompt_result.data

# Использовать с Claude
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=4000,
    system=system_prompt,
    messages=[{
        "role": "user",
        "content": "Generate 3 video scenario candidates with emotional arcs"
    }]
)

scenarios = response.content[0].text
```

**Что содержит промпт:**
- ✅ Оптимальная длительность на основе медианы (n=X видео)
- ✅ Тайминги emotional beats (intro/build/peak/payoff)
- ✅ Качественные бенчмарки (scores 0-1)
- ✅ Успешные эмоциональные теги
- ✅ Популярные контентные темы
- ✅ Целевые показатели engagement

---

### 2. `auto_score_scenario(scenario_jsonb)`

**Цель:** Автоматически оценить сценарий против бенчмарков топ-видео

**Параметры:**
- `scenario_jsonb` - JSON объект со структурой:
  ```json
  {
    "duration_s": 30,
    "beats": [
      {"name": "intro", "start_s": 0, "end_s": 3},
      {"name": "build", "start_s": 3, "end_s": 12},
      {"name": "peak", "start_s": 12, "end_s": 20},
      {"name": "payoff", "start_s": 20, "end_s": 28}
    ],
    "emotional_tags": ["rescue", "tears", "happy_ending"]
  }
  ```

**Возвращает:** jsonb - объект с оценками:
```json
{
  "duration_fit": 0.95,        // Насколько длина близка к оптимальной
  "hook_timing": 1.0,          // Качество hook'а (быстрота)
  "payoff_timing": 0.88,       // Payoff в правильное время
  "peak_position": 1.0,        // Peak в середине видео
  "emotional_tag_match": 0.6,  // % совпадения с топ-тегами
  "overall": 0.886,            // Общая оценка (weighted avg)
  "benchmarks_from": 29,       // Размер выборки
  "scored_at": "2025-10-24..."
}
```

**Пример использования:**

```python
# После получения сценария от LLM
scenario = {
    "duration_s": 30,
    "beats": [
        {"name": "intro", "start_s": 0, "end_s": 3, "description": "Hook: Dog trapped in drain"},
        {"name": "build", "start_s": 3, "end_s": 12, "description": "Rescuers arrive, tension builds"},
        {"name": "peak", "start_s": 12, "end_s": 20, "description": "Difficult extraction, emotions high"},
        {"name": "payoff", "start_s": 20, "end_s": 28, "description": "Dog safe, reunited with owner"}
    ],
    "emotional_tags": ["rescue", "emotional", "tears", "happy_ending", "dog"]
}

# Автоскоринг
score_result = supabase.rpc('auto_score_scenario', {
    'p_scenario': scenario
}).execute()

scores = score_result.data
print(f"Overall score: {scores['overall']}")

# Сохранить в generation_events
supabase.table('generation_events').update({
    'aes_score': scores['overall'],
    'hook_strength': scores['hook_timing'],
    'evaluator': 'auto_scorer_v1'
}).eq('id', event_id).execute()

# Выбрать лучший из кандидатов
if scores['overall'] > 0.8:
    # Принять сценарий
    pass
else:
    # Попросить LLM улучшить
    pass
```

---

### 3. `find_similar_videos(topic, duration_s, limit)`

**Цель:** Найти похожие успешные видео для референса/вдохновения

**Параметры:**
- `topic` (text) - тема для поиска
- `duration_s` (integer) - желаемая длительность (±20%)
- `limit` (integer) - сколько видео вернуть (по умолчанию 5)

**Возвращает:** TABLE с колонками:
- `video_id` (uuid)
- `title` (text)
- `duration_seconds` (integer)
- `engagement_rate` (numeric) - %
- `overall_score` (numeric) - 0-1
- `emotional_tags` (jsonb)
- `analysis_url` (text) - ссылка на полный анализ

**Пример использования:**

```python
# Найти похожие успешные видео
similar = supabase.rpc('find_similar_videos', {
    'p_topic': 'rescue dog',
    'p_duration_s': 30,
    'p_limit': 5
}).execute()

print("Top similar performers:")
for video in similar.data:
    print(f"\n{video['title']}")
    print(f"  Duration: {video['duration_seconds']}s")
    print(f"  Engagement: {video['engagement_rate']}%")
    print(f"  Score: {video['overall_score']}")
    print(f"  Tags: {video['emotional_tags']}")
    print(f"  Analysis: {video['analysis_url']}")

# Можно использовать для:
# 1. Показа пользователю в UI
# 2. Дополнительного контекста для LLM
# 3. Извлечения паттернов для улучшения промпта
```

---

### 4. `get_top_patterns_for_llm()`

**Цель:** Получить сырые данные паттернов (JSON) для кастомного использования

**Параметры:** нет

**Возвращает:** jsonb - структурированные данные:
```json
{
  "typical_duration_s": 35,
  "duration_range": {
    "p25": 28,
    "median": 35,
    "p75": 45
  },
  "emotional_arc": {
    "intro_duration": 3.2,
    "build_duration": 8.5,
    "peak_duration": 7.8,
    "payoff_duration": 6.5,
    "payoff_end_percent": 85
  },
  "quality_benchmarks": {
    "overall_score": 0.82,
    "emotional_score": 0.88,
    "hook_strength": 0.91,
    "pacing_score": 0.78
  },
  "engagement_targets": {
    "avg_rate": 4.2,
    "median_rate": 3.8
  },
  "emotional_tags": ["rescue", "tears", "emotional", "happy_ending"],
  "content_tags": ["animals", "dogs", "rescue", "viral"],
  "sample_size": 29,
  "top_performers": {
    "count": 3,
    "avg_engagement": 8.5,
    "avg_duration": 32,
    "avg_emotional_score": 0.95
  },
  "last_updated": "2025-10-24T..."
}
```

**Пример использования:**

```python
# Получить сырые паттерны
patterns = supabase.rpc('get_top_patterns_for_llm').execute().data

# Использовать для дашборда
print(f"Based on {patterns['sample_size']} top videos:")
print(f"Optimal duration: {patterns['typical_duration_s']}s")
print(f"Hook should end by: {patterns['emotional_arc']['intro_duration']}s")
print(f"Target engagement: {patterns['engagement_targets']['median_rate']}%")

# Или создать кастомный промпт
custom_prompt = f"""
Create a {patterns['typical_duration_s']} second video where:
- Hook ends by {patterns['emotional_arc']['intro_duration']}s
- Emotional peak around {patterns['emotional_arc']['peak_duration']}s
- Use these proven tags: {', '.join(patterns['emotional_tags'][:5])}
- Target engagement rate: {patterns['engagement_targets']['median_rate']}%
"""
```

---

## 🔄 Workflow: Полный цикл генерации

### Шаг 1: Получить data-driven промпт

```python
system_prompt = supabase.rpc('build_llm_system_prompt', {
    'p_topic': user_topic,
    'p_duration_category': 'short'
}).execute().data
```

### Шаг 2: Генерация с LLM

```python
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    system=system_prompt,
    messages=[{
        "role": "user",
        "content": "Generate 3 video scenario candidates"
    }]
)

# Парсить JSON из ответа
candidates = json.loads(response.content[0].text)
```

### Шаг 3: Автоскоринг кандидатов

```python
scored_candidates = []

for candidate in candidates:
    scores = supabase.rpc('auto_score_scenario', {
        'p_scenario': candidate
    }).execute().data

    candidate['scores'] = scores
    scored_candidates.append(candidate)

# Сортировать по overall score
scored_candidates.sort(key=lambda x: x['scores']['overall'], reverse=True)
best = scored_candidates[0]
```

### Шаг 4: Сохранить в БД

```python
# Создать generation_event
event = supabase.table('generation_events').insert({
    'user_id': user_id,
    'topic': user_topic,
    'duration_category': 'short',
    'scenario': best,
    'candidates': scored_candidates,
    'chosen_index': 0,
    'aes_score': best['scores']['overall'],
    'hook_strength': best['scores']['hook_timing'],
    'evaluator': 'auto_scorer_v1',
    'status': 'ready_for_composition'
}).execute()
```

### Шаг 5: Создать композицию (отправить в очередь)

```python
# Создать assets для каждого beat
# Отправить в generation queue
# ...
```

---

## 📈 Мониторинг и обновление данных

### Автоматическое обновление

Materialized view `mv_top_patterns` **автоматически обновляется каждые 6 часов** через pg_cron.

```sql
-- Проверить расписание
SELECT * FROM v_cron_jobs WHERE jobname = 'refresh-analytics-views';

-- Проверить последнее обновление
SELECT * FROM get_materialized_view_stats()
WHERE view_name = 'mv_top_patterns';
```

### Ручное обновление

```sql
-- Если нужно обновить немедленно (например, после добавления новых video_analysis)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_patterns;
```

### Просмотр рекомендаций

```sql
-- Для дашборда/UI
SELECT * FROM v_generation_recommendations;
```

---

## 🎨 Интеграция с UI Dashboard

### Показать текущие рекомендации

```typescript
// TypeScript + Supabase client
const { data: recommendations } = await supabase
  .rpc('get_top_patterns_for_llm')

// Отобразить в UI
<div>
  <h3>Current Recommendations (n={recommendations.sample_size})</h3>
  <p>Optimal Duration: {recommendations.typical_duration_s}s</p>
  <p>Hook by: {recommendations.emotional_arc.intro_duration}s</p>
  <p>Target Engagement: {recommendations.engagement_targets.median_rate}%</p>

  <div>
    <h4>Top Emotional Tags:</h4>
    {recommendations.emotional_tags.map(tag => (
      <Badge key={tag}>{tag}</Badge>
    ))}
  </div>
</div>
```

### Показать похожие видео

```typescript
const { data: similar } = await supabase
  .rpc('find_similar_videos', {
    p_topic: userTopic,
    p_duration_s: 30,
    p_limit: 5
  })

// Grid с похожими видео
<Grid>
  {similar.map(video => (
    <VideoCard key={video.video_id}>
      <h4>{video.title}</h4>
      <p>Engagement: {video.engagement_rate}%</p>
      <p>Score: {video.overall_score}/1.0</p>
      <a href={video.analysis_url}>View Analysis</a>
    </VideoCard>
  ))}
</Grid>
```

### Real-time scoring в UI

```typescript
// После генерации сценария показать live scoring
const scenario = llmResponse.scenario

const { data: scores } = await supabase
  .rpc('auto_score_scenario', {
    p_scenario: scenario
  })

// Прогресс бары
<div>
  <ProgressBar
    label="Overall Quality"
    value={scores.overall}
    target={0.8}
  />
  <ProgressBar
    label="Hook Timing"
    value={scores.hook_timing}
    target={0.9}
  />
  <ProgressBar
    label="Emotional Tags"
    value={scores.emotional_tag_match}
    target={0.6}
  />
</div>

{scores.overall < 0.7 && (
  <Alert>
    This scenario scores below average. Consider regenerating.
  </Alert>
)}
```

---

## 🔧 Troubleshooting

### "Function returned NULL"

Это значит в `mv_top_patterns` нет данных (нет video_analysis с score > 0.7)

**Решение:**
1. Добавить больше video_analysis с высокими scores
2. Понизить порог в materialized view (изменить `> 0.7` на `> 0.5`)

### "Materialized view out of date"

**Проверить:**
```sql
SELECT last_updated FROM mv_top_patterns;
```

**Обновить вручную:**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_patterns;
```

### "Scores seem incorrect"

**Проверить базовые паттерны:**
```sql
SELECT * FROM get_top_patterns_for_llm();
```

Убедиться что `sample_size` достаточный (минимум 10-20 видео)

---

## 📝 Best Practices

1. **Всегда проверяйте `sample_size`** перед использованием рекомендаций
   ```python
   patterns = get_patterns()
   if patterns['sample_size'] < 10:
       # Использовать fallback defaults
   ```

2. **Кэшируйте системные промпты** (они обновляются раз в 6 часов)
   ```python
   # Redis/memory cache
   prompt = cache.get('system_prompt_short_rescue')
   if not prompt:
       prompt = build_llm_system_prompt(...)
       cache.set('system_prompt_short_rescue', prompt, ttl=6*3600)
   ```

3. **Логируйте scores** для мониторинга качества
   ```python
   logger.info(f"Scenario scored: {scores['overall']}", extra={
       'scenario_id': scenario_id,
       'scores': scores,
       'benchmarks_from': scores['benchmarks_from']
   })
   ```

4. **A/B тестируйте** статические vs data-driven промпты
   ```python
   if random.random() < 0.5:
       # Group A: data-driven
       prompt = build_llm_system_prompt(...)
   else:
       # Group B: static prompt
       prompt = STATIC_PROMPT
   ```

---

## 🚀 Next Steps

1. Добавить больше video_analysis для улучшения паттернов
2. Настроить A/B тесты для валидации подхода
3. Создать feedback loop: engagement реальных видео → обновление весов в скоринге
4. Добавить per-topic паттерны (не только глобальные)

---

**Вопросы?** Проверьте `DATABASE_OPTIMIZATION_SUMMARY.md` для деталей реализации.
