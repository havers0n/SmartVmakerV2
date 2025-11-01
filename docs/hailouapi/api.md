Subject-Reference to Video Generation Task — выжимка
Эндпоинт

POST https://api.minimax.io/v1/video_generation

Аутентификация

HTTP Bearer — заголовок Authorization: Bearer <API_KEY>

Заголовки

Content-Type: application/json (обязателен)

Тело запроса (JSON)
Поле	Тип	Обязательно	Описание / ограничения
model	string	да	Только S2V-01.
prompt	string	нет	Текстовое описание видео, до ~2000 символов.
prompt_optimizer	boolean	нет	Авто-оптимизация промпта, по умолчанию true. Выключайте (false) для точного контроля.
subject_reference	array<SubjectReference>	да	Ссылки на референс-изображения субъекта (персонажа). Требуется ровно 1 изображение в массиве image.
callback_url	string (URL)	нет	Вебхук: сначала валидация с полем challenge (нужно эхонуть за ≤3 с), далее пуш статусов задачи.
Схема SubjectReference
Поле	Тип	Обязательно	Описание
type	string	да	Тип субъекта: сейчас только character (лицо человека).
image	array<string>	да	Массив из одного изображения (URL или Data URL). Форматы: JPG/JPEG/PNG/WebP; размер < 20 MB; короткая сторона > 300px; соотношение сторон 2:5 – 5:2.
Ответ 200 OK
{
  "task_id": "106916112212032",
  "base_resp": { "status_code": 0, "status_msg": "success" }
}

Коды base_resp.status_code (важное)

0 — успех

1002 — rate limit (повторите позже)

1004 — ошибка аутентификации (проверьте API-ключ)

1008 — недостаточно средств

1026 — чувствительный контент

2013 — невалидные параметры

2049 — невалидный API-ключ

Поведение callback_url

Валидация: POST { "challenge": "<строка>" } → ответить { "challenge": "<та же строка>" } в течение 3 сек.

Обновления: при изменении статуса задачи MiniMax шлёт JSON как у «Query Video Generation Task», поле status: processing / success (вернётся file_id) / failed.

Примеры
cURL
curl -X POST "https://api.minimax.io/v1/video_generation" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "S2V-01",
    "prompt": "A girl runs toward the camera and winks with a smile.",
    "prompt_optimizer": true,
    "subject_reference": [
      {
        "type": "character",
        "image": [
          "https://cdn.hailuoai.com/prod/2025-08-12-17/video_cover/1754990600020238321-411603868533342214-cover.jpg"
        ]
      }
    ],
    "callback_url": "https://your.domain.com/minimax-callback"
  }'

TypeScript (fetch)
const res = await fetch("https://api.minimax.io/v1/video_generation", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.MINIMAX_API_KEY!}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "S2V-01",
    prompt: "A girl runs toward the camera and winks with a smile.",
    prompt_optimizer: true,
    subject_reference: [
      {
        type: "character",
        image: [
          "https://cdn.hailuoai.com/prod/2025-08-12-17/video_cover/1754990600020238321-411603868533342214-cover.jpg",
        ],
      },
    ],
    callback_url: "https://your.domain.com/minimax-callback",
  }),
});

if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
// data.task_id → используйте для запроса статуса/результата

Python (requests)
import os, requests

url = "https://api.minimax.io/v1/video_generation"
headers = {
    "Authorization": f"Bearer {os.environ['MINIMAX_API_KEY']}",
    "Content-Type": "application/json",
}
payload = {
    "model": "S2V-01",
    "prompt": "A girl runs toward the camera and winks with a smile.",
    "prompt_optimizer": True,
    "subject_reference": [{
        "type": "character",
        "image": ["https://cdn.hailuoai.com/prod/2025-08-12-17/video_cover/1754990600020238321-411603868533342214-cover.jpg"]
    }],
    "callback_url": "https://your.domain.com/minimax-callback"
}
r = requests.post(url, json=payload, headers=headers, timeout=60)
r.raise_for_status()
print(r.json())

FastAPI: обработка колбэка
from fastapi import FastAPI, Request, HTTPException
app = FastAPI()

@app.post("/minimax-callback")
async def minimax_callback(request: Request):
    try:
        payload = await request.json()
        if "challenge" in payload:
            return {"challenge": payload["challenge"]}  # ответ за ≤3с
        # payload наподобие:
        # { "task_id": "...", "status": "processing|success|failed", "file_id": "...", "base_resp": {...} }
        # TODO: сохранить статус / инициировать скачивание по file_id
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

Чек-лист интеграции

Подготовьте 1 референс-изображение субъекта (валидный URL или Data URL, соблюдая формат/размер/разрешение).

Передайте model: "S2V-01", subject_reference с type: "character" и массивом image из одного элемента.

Опционально задайте prompt и решите, нужен ли prompt_optimizer.

Если нужен вебхук — настройте callback_url и реализуйте challenge-echo.

Обрабатывайте task_id: опрашивайте статус/получайте результат; на 1002 внедрите ретраи с backoff.

Create First & Last Frame Video Generation Task — выжимка
Эндпоинт

POST https://api.minimax.io/v1/video_generation

Аутентификация

HTTP Bearer: заголовок Authorization: Bearer <API_KEY>

Заголовки

Content-Type: application/json (обязателен)

Тело запроса (JSON)
Поле	Тип	Обязательно	Значение/ограничения
model	string	да	Только MiniMax-Hailuo-02. Примечание: режим first/last frame не поддерживает 512P.
prompt	string	нет	До ~2000 символов. Поддерживает команды камеры в квадратных скобках (см. ниже).
first_frame_image	string (URL или Data URL Base64)	нет	Первый кадр. Форматы: JPG/JPEG/PNG/WebP; < 20 MB; короткая сторона > 300px; соотношение сторон 2:5–5:2. Именно этот кадр определяет разрешение видео.
last_frame_image	string (URL или Data URL Base64)	да	Последний кадр. Те же требования. Если размеры отличаются от первого кадра — кадр обрежется под размеры первого.
prompt_optimizer	boolean	нет	Авто-оптимизация промпта. По умолчанию true. Выключайте для максимального контроля.
duration	integer (сек)	нет	По умолчанию 6. Доступные значения зависят от разрешения/модели: для MiniMax-Hailuo-02: 768P: 6 или 10, 1080P: 6.
resolution	string	нет	768P (значение по умолчанию) или 1080P. В режиме first/last frame поддерживаются только 768P и 1080P.
callback_url	string (URL)	нет	Вебхук для статусов. При настройке придёт валидационный POST с полем challenge, на который нужно ответить тем же значением в течение 3 с. Далее пушатся статусы задач (структура как у API «Query Video Generation Task»).
Команды камеры в prompt (MiniMax-Hailuo-02)

Движения (15):
Truck [left|right], Pan [left|right], Push in / Pull out, Pedestal [up|down], Tilt [up|down], Zoom [in|out], Shake, Tracking shot, Static shot.

Правила использования:

Одновременные: несколько команд внутри одних [] срабатывают совместно, напр. [Pan left,Pedestal up] (рекомендуемо ≤ 3 одновременно).

Последовательные: команды в тексте идут по порядку: …[Push in], then …[Pull out].

Нативный язык тоже работает, но явные команды дают более точный контроль.

Ответ 200 OK
{
  "task_id": "106916112212032",
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  }
}


task_id — идентификатор задачи, используйте для последующего опроса статуса.

base_resp.status_code — коды:

0 — успех

1002 — rate limit

1004 — ошибка аутентификации (проверьте API-ключ)

1008 — недостаточно средств

1026 — чувствительный контент в промпте

2013 — невалидные параметры

2049 — невалидный API-ключ
(Полный справочник — «Error Code Reference» в документации MiniMax.)

Поведение callback (callback_url)

Сразу после настройки: POST с { "challenge": "<строка>" } → ответить { "challenge": "<та же строка>" } в течение 3 с.

В процессе генерации MiniMax присылает статусы:

processing — в работе

success — готово (будет file_id)

failed — ошибка

Структура payload совпадает с ответом «Query Video Generation Task».

Важные замечания и граничные условия

Разрешение видео наследуется от first_frame_image (даже если указали resolution). При несовпадении размеров последний кадр кропнется под первый.

В режиме first/last frame доступны только 768P и 1080P (512P недоступно).

Для 1080P длительность — только 6 сек.

Изображения должны быть доступны (публичные URL) или переданы как Data URL (Base64).

При частых запросах возможен rate limit (1002) — реализуйте повтор с backoff.

Примеры
cURL
curl -X POST "https://api.minimax.io/v1/video_generation" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "MiniMax-Hailuo-02",
    "prompt": "A little girl grow up. [Push in],[Pan right]",
    "first_frame_image": "https://filecdn.minimax.chat/public/fe9d04da-f60e-444d-a2e0-18ae743add33.jpeg",
    "last_frame_image": "https://filecdn.minimax.chat/public/97b7cd08-764e-4b8b-a7bf-87a0bd898575.jpeg",
    "duration": 6,
    "resolution": "1080P",
    "prompt_optimizer": true,
    "callback_url": "https://your.domain.com/minimax-callback"
  }'

TypeScript (fetch)
const res = await fetch("https://api.minimax.io/v1/video_generation", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.MINIMAX_API_KEY!}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "MiniMax-Hailuo-02",
    prompt: "A little girl grow up. [Tracking shot],[Tilt up]",
    first_frame_image: "https://filecdn.minimax.chat/public/fe9d04da-f60e-444d-a2e0-18ae743add33.jpeg",
    last_frame_image: "https://filecdn.minimax.chat/public/97b7cd08-764e-4b8b-a7bf-87a0bd898575.jpeg",
    duration: 6,
    resolution: "768P",
    prompt_optimizer: true,
    callback_url: "https://your.domain.com/minimax-callback"
  }),
});

if (!res.ok) {
  throw new Error(`HTTP ${res.status}`);
}
const data = await res.json();
// data.task_id → используйте в «Query Video Generation Task»

Python (requests)
import requests, os

url = "https://api.minimax.io/v1/video_generation"
headers = {
    "Authorization": f"Bearer {os.environ['MINIMAX_API_KEY']}",
    "Content-Type": "application/json",
}
payload = {
    "model": "MiniMax-Hailuo-02",
    "prompt": "A little girl grow up. [Zoom in],[Pedestal up]",
    "first_frame_image": "https://filecdn.minimax.chat/public/fe9d04da-f60e-444d-a2e0-18ae743add33.jpeg",
    "last_frame_image":  "https://filecdn.minimax.chat/public/97b7cd08-764e-4b8b-a7bf-87a0bd898575.jpeg",
    "duration": 6,
    "resolution": "1080P",
    "prompt_optimizer": True,
    "callback_url": "https://your.domain.com/minimax-callback"
}
r = requests.post(url, json=payload, headers=headers, timeout=60)
r.raise_for_status()
print(r.json())

FastAPI: обработка callback (валидация + статусы)
from fastapi import FastAPI, Request, HTTPException
app = FastAPI()

@app.post("/minimax-callback")
async def minimax_callback(request: Request):
    try:
        payload = await request.json()
        if "challenge" in payload:
            return {"challenge": payload["challenge"]}  # ответить за ≤3с
        # обработка статусов
        # { "task_id": "...", "status": "processing|success|failed", "file_id": "...", "base_resp": {...} }
        # TODO: сохранить статус, дернуть загрузку по file_id и т.п.
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))