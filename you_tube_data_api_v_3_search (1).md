# YouTube Data API v3 — `search.list`: практическое руководство (2025)

> Версия: октябрь 2025 • Язык: RU • Аудитория: разработчики (JS/TS, Python, HTTP)

## Оглавление
- [1. Назначение и типовые кейсы](#назначение-и-типовые-кейсы)
- [2. Модель данных ответа](#модель-данных-ответа)
- [3. Параметры запроса](#параметры-запроса)
  - [3.1 Обязательные](#обязательные)
  - [3.2 Часто используемые фильтры](#часто-используемые-фильтры)
  - [3.3 Видео‑фильтры (требуют `type=video`)](#видео‑фильтры-требуют-typevideo)
  - [3.4 Сортировка и пагинация](#сортировка-и-пагинация)
  - [3.5 Оптимизация по полям (`part`, `fields`)](#оптимизация-по-полям-part-fields)
- [4. Квоты и производительность](#квоты-и-производительность)
- [5. Частые ошибки и диагностика](#частые-ошибки-и-диагностика)
- [6. Best practices](#best-practices)
- [7. Примеры запросов](#примеры-запросов)
  - [7.1 cURL (HTTP)](#curl-http)
  - [7.2 Node.js (googleapis)](#nodejs-googleapis)
  - [7.3 Python (google-api-python-client)](#python-google-api-python-client)
- [8. Типовые сценарии](#типовые-сценарии)
- [9. Чек‑лист запуска в прод](#чек‑лист-запуска-в-прод)
- [10. FAQ](#faq)

---

## 1. Назначение и типовые кейсы
`search.list` — универсальная точка для полнотекстового поиска по YouTube с фильтрацией по типу ресурса: **видео**, **каналы**, **плейлисты**. Типовые кейсы:
- Поиск свежих трендовых роликов по ключевым словам и/или по языку/региону.
- Нахождение каналов/плейлистов под нишу.
- Отбор только **встраиваемых** (embeddable) видео.
- Предфильтрация по длительности, субтитрам, лицензии, live‑событиям и т. п.

> **Важно:** `search.list` отдаёт **поисковую выдачу**, а не полные объекты видео. Идентификаторы из поиска далее обогащаются методами `videos.list`, `channels.list`, `playlists.list`.

---

## 2. Модель данных ответа
Ответ — ресурс `searchListResponse` с ключами:
- `kind`, `etag`
- `regionCode`
- `pageInfo { totalResults, resultsPerPage }`
- `nextPageToken` / `prevPageToken`
- `items[]` — элементы с частями (`part`)
  - типично: `id { kind, videoId | channelId | playlistId }`,
  - `snippet { publishedAt, channelId, title, description, thumbnails, channelTitle, liveBroadcastContent }`

> Для получения статистики (просмотры, лайки), длительности ISO 8601, тегов и т. п. — используйте `videos.list` c `part=statistics,contentDetails` по собранным `videoId`.

---

## 3. Параметры запроса

### 3.1 Обязательные
- `part` — как минимум `snippet`. (Для `search.list` это единственная доступная часть.)

### 3.2 Часто используемые фильтры
- `q` — поисковая строка (UTF‑8). Поддерживает обычные слова и операторы (кавычки для фраз).
- `type` — `video` | `channel` | `playlist` (по умолчанию — все типы).
- `maxResults` — 0–50, по умолчанию 5. Рекомендуемая страница: 25–50.
- `publishedAfter` / `publishedBefore` — ISO 8601 (UTC). Удобно для «за последние N дней».
- `regionCode` — ISO‑3166‑1 alpha‑2 (например, `US`, `IL`).
- `relevanceLanguage` — язык релевантности (например, `en`, `ru`, `he`).
- `safeSearch` — `none` | `moderate` | `strict`.
- `order` — `date` | `rating` | `relevance` | `title` | `videoCount` | `viewCount`.

### 3.3 Видео‑фильтры (требуют `type=video`)
- `videoDuration` — `short` (< 4 мин) | `medium` (4–20) | `long` (> 20) | `any`.
- `videoDefinition` — `any` | `high` (HD) | `standard`.
- `videoCaption` — `any` | `closedCaption` | `none`.
- `videoEmbeddable` — `true` | `any`.
- `videoLicense` — `youtube` | `creativeCommon`.
- `eventType` — `completed` | `live` | `upcoming` (совм. с `type=video`).
- `videoSyndicated`, `videoPaidProductPlacement` — спец‑фильтры.

### 3.4 Сортировка и пагинация
- `pageToken` — продолжение выборки; используйте `nextPageToken` из ответа.
- `order=date` — сортировка по дате публикации; учтите, что без `type` и корректных фильтров релевантность может влиять на выдачу.

### 3.5 Оптимизация по полям (`part`, `fields`)
- `part=snippet` — достаточно для превью/идентификаторов.
- `fields=items(id/videoId,id/channelId,id/playlistId,snippet(title,publishedAt)),nextPageToken,pageInfo` — частичные ответы снижают размер.

---

## 4. Квоты и производительность
- Стоимость запроса `search.list` — **100 units** за звонок (каждая страница — отдельно).
- Бюджет проекта по умолчанию: 10 000 units/сутки.
- Снижайте стоимость:
  - Минимизируйте число страниц (`maxResults` + проверка достаточности).
  - Используйте `fields` для урезания ответа.
  - Кешируйте выдачу (эластичное обновление по `publishedAfter`).
  - Разносите: `search.list` (идентификаторы) → батч‑обогащение через `videos.list` (1 unit/запрос).

---

## 5. Частые ошибки и диагностика
- `400 invalidParameter` — несовместимые параметры (напр., `videoDuration` без `type=video`).
- `400 badRequest` — неверные значения (`regionCode`, `order`).
- `403 quotaExceeded` — превышен суточный лимит.
- `403 forbidden` — нарушение политик или запретные параметры.
- `429 rateLimitExceeded` — слишком частые запросы.
- Диагностика:
  - Смотрите `error.errors[].reason`, `domain`, `message`.
  - Включите логирование полных HTTP‑ответов + корреляционные ID.

---

## 6. Best practices
1. **Строгое разделение стадий:** поиск → сбор ID → обогащение (`videos.list`).
2. **Дедупликация** по `(kind,id)`; кэш ID с TTL.
3. **Идемпотентность** пагинации: храните `pageToken`/водораздел по `publishedAt`.
4. **Регион/язык**: задавайте `regionCode` + `relevanceLanguage` для локальной выдачи.
5. **Безопасный контент**: `safeSearch` = `moderate/strict` для пользовательских приложений.
6. **Этика и политики**: соблюдайте ToS/Policies, не кэшируйте навсегда персональные данные.
7. **Ретраи** c экспоненциальной паузой для `429/5xx`.
8. **Наблюдаемость**: метрики hit‑ratio кэша, средний размер ответа, квоты/сутки, доля «пустых» страниц.

---

## 7. Примеры запросов

### 7.1 cURL (HTTP)
```bash
# Поиск HD‑видео длительностью до 4 минут на иврите, свежие, встраиваемые
curl -s 'https://www.googleapis.com/youtube/v3/search' \
  -G \
  --data-urlencode 'key=YOUR_API_KEY' \
  --data-urlencode 'part=snippet' \
  --data-urlencode 'q=כלבים מצחיקים' \
  --data-urlencode 'type=video' \
  --data-urlencode 'order=date' \
  --data-urlencode 'relevanceLanguage=he' \
  --data-urlencode 'regionCode=IL' \
  --data-urlencode 'videoDefinition=high' \
  --data-urlencode 'videoDuration=short' \
  --data-urlencode 'videoEmbeddable=true' \
  --data-urlencode 'maxResults=25' \
  --data-urlencode 'publishedAfter=2025-10-01T00:00:00Z' \
  --data-urlencode 'fields=items(id/videoId,snippet(title,publishedAt,channelTitle,thumbnails/default/url)),nextPageToken,pageInfo'
```

### 7.2 Node.js (googleapis)
```ts
import { google } from 'googleapis'

const youtube = google.youtube({ version: 'v3', auth: process.env.YT_API_KEY })

async function searchShortHdEmbeddable(q: string) {
  const res = await youtube.search.list({
    part: ['snippet'],
    q,
    type: ['video'],
    order: 'date',
    relevanceLanguage: 'he',
    regionCode: 'IL',
    videoDefinition: 'high',
    videoDuration: 'short',
    videoEmbeddable: 'true',
    maxResults: 25,
    publishedAfter: '2025-10-01T00:00:00Z',
    fields: 'items(id/videoId,snippet(title,publishedAt,channelTitle,thumbnails/default/url)),nextPageToken,pageInfo'
  })
  return res.data
}
```

### 7.3 Python (google-api-python-client)
```python
from googleapiclient.discovery import build

yt = build('youtube', 'v3', developerKey=YOUR_API_KEY)

req = yt.search().list(
    part='snippet', q='funny dogs', type='video', order='date',
    regionCode='US', relevanceLanguage='en',
    videoDefinition='high', videoDuration='short', videoEmbeddable='true',
    maxResults=25, publishedAfter='2025-10-01T00:00:00Z',
    fields='items(id/videoId,snippet(title,publishedAt,channelTitle,thumbnails/default/url)),nextPageToken,pageInfo'
)
res = req.execute()
print(res)
```

---

## 8. Типовые сценарии
- **Виральные шорты по нише**: `q` + `type=video` + `videoDuration=short` + `order=viewCount` + ограничение по дате.
- **Каналы‑конкуренты**: `q` по ключевой фразе + `type=channel` + сортировка по `videoCount`.
- **Live‑идентификация**: `eventType=live` + `type=video` для мониторинга прямых эфиров.
- **Только встраиваемые**: `videoEmbeddable=true` для избежания проблем с embed‑плеером.

---

## 9. Чек‑лист запуска в прод
- [ ] Нормализованы и валидированы параметры (совместимость фильтров).
- [ ] Лимитные значения `maxResults` и контролируемая пагинация.
- [ ] Кеш и водораздел по времени для инкрементальной выборки.
- [ ] Ограниченные `fields`; удалённые лишние поля в ответах.
- [ ] Ретраи/джиттер/таймауты; распознавание `429/5xx`.
- [ ] Мониторинг квот; алерты при >70%/сутки.
- [ ] Обогащение через `videos.list` и слои DTO.
- [ ] Соответствие ToS/Policies и удаление персональных данных при необходимости.

---

## 10. FAQ
**Можно ли получить полную статистику видео через `search.list`?**  
Нет, только базовый `snippet` + `id`. Используйте `videos.list`.

**Почему `order=date` «не работает» как ожидается?**  
Проверьте, что указан `type=video`, нет конфликтующих фильтров, и учитывайте персонализацию/релевантность поиска. Иногда кажется, что сортировка «смазывается» без точных фильтров.

**Как уменьшить стоимость поиска?**  
Урезайте `fields`, повышайте `maxResults`, минимизируйте страницы, кешируйте, переносите обогащение в дешёвые методы (`videos.list`).

**Как получать только CC‑ролики?**  
`type=video&videoLicense=creativeCommon`.

**Как искать только с субтитрами?**  
`type=video&videoCaption=closedCaption`.

