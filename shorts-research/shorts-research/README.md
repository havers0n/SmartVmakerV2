# Shorts Reverse Engineering

Воспроизводимый пайплайн для исследования вирусных YouTube Shorts: сбор метаданных и транскриптов, извлечение признаков, AI-разметка, отчёты и генерация оригинальных сценариев.

## Быстрый старт

```powershell
cd shorts-research
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Необязательно: перенести уже собранные id/url/title из внешнего CSV
python scripts/collect.py --seed-csv ..\i11ush_100_shorts.csv

# 1. Получить метаданные роликов
python scripts/collect.py "https://www.youtube.com/@CHANNEL/shorts" --limit 100

# 2. Получить транскрипты: YouTube-субтитры, иначе локальный Whisper
python -m pip install faster-whisper
python scripts/transcribe.py --languages ru en --limit 5
python scripts/transcribe.py --languages ru en

# 3. Построить features.csv
python scripts/analyze.py features

# 4. AI-разметка (нужен OPENAI_API_KEY в окружении)
python scripts/annotate.py --model gpt-4.1-mini

# 5. Построить базу знаний и отчёты
python scripts/analyze.py knowledge-base

# 6. Собрать prompt для сценария
python scripts/export.py --topic "необычные законы" --duration 45 --structure 7 --hook 18 --ending 4
```

## Артефакты

| Файл | Содержимое |
| --- | --- |
| `data/videos.csv` | `id`, URL, название, просмотры, дата, длительность и транскрипт |
| `data/features.csv` | первые/последние 5 секунд и статистические признаки |
| `data/annotations/annotations.jsonl` | по одной AI-аннотации на ролик, включая Content DNA |
| `reports/*.md` | ранжированные хуки, финалы, шаблоны, темы и эмоциональные триггеры |

## Повторный запуск

Все шаги идемпотентны: сбор обновляет ролики по `id`, транскрипция пропускает уже полученные тексты, разметка пропускает уже аннотированные ролики. Используйте `--force`, чтобы пересоздать данные конкретного шага.

> Если YouTube не отдаёт субтитры, `transcribe.py` скачивает аудио через `yt-dlp` и запускает локальный `faster-whisper`. Модель `small` скачивается при первом запуске. Для проверки только субтитров добавьте `--no-whisper`; для GPU можно передать `--device cuda --compute-type float16`.

Поля `names`, `countries` и `brands` в `features.csv` извлекаются консервативными правилами; их стоит рассматривать как кандидаты для проверки, а не как полноценный NER.
