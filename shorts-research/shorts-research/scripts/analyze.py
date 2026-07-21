"""Extract measurable features and aggregate annotated patterns into reports."""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
VIDEOS = DATA / "videos.csv"
FEATURES = DATA / "features.csv"
ANNOTATIONS = DATA / "annotations" / "annotations.jsonl"
TRANSCRIPTS = DATA / "transcripts"
REPORTS = ROOT / "reports"

COUNTRIES = {"сша", "россия", "украина", "великобритания", "англия", "франция", "германия", "китай", "япония", "индия", "канада", "австралия", "бразилия", "мексика", "израиль", "америка", "usa", "uk"}
BRANDS = {"apple", "google", "microsoft", "amazon", "tesla", "netflix", "tiktok", "youtube", "disney", "nike", "coca-cola", "samsung", "openai", "meta"}
WORD = re.compile(r"[\w'-]+", re.UNICODE)
SENTENCE = re.compile(r"[^.!?…]+[.!?…]+|[^.!?…]+$", re.UNICODE)
FEATURE_FIELDS = ["id", "first_5_seconds", "last_5_seconds", "word_count", "words_per_second",
                  "sentence_count", "question_count", "numbers", "names", "countries", "brands"]


def timed_excerpt(video_id: str, duration: float, first: bool) -> str:
    file = TRANSCRIPTS / f"{video_id}.json"
    if not file.exists():
        return ""
    segments = json.loads(file.read_text(encoding="utf-8"))
    if first:
        selected = [s["text"] for s in segments if float(s["start"]) < 5]
    else:
        selected = [s["text"] for s in segments if float(s["start"]) + float(s.get("duration", 0)) > max(0, duration - 5)]
    return " ".join(selected)


def entities(text: str, values: set[str]) -> str:
    lower = text.lower()
    return "; ".join(sorted(value for value in values if re.search(rf"(?<!\w){re.escape(value)}(?!\w)", lower)))


def probable_names(text: str) -> str:
    # Conservative heuristic for both Cyrillic and Latin proper names; review before treating as NER truth.
    matches = re.findall(r"(?<![.!?]\s)(?<!^)\b[А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)?", text)
    return "; ".join(dict.fromkeys(matches))


def make_features() -> None:
    if not VIDEOS.exists():
        raise SystemExit("Нет data/videos.csv. Запустите collect.py.")
    videos = pd.read_csv(VIDEOS, dtype={"id": str}).fillna("")
    rows = []
    for _, video in videos.iterrows():
        text = str(video.transcript).strip()
        duration = float(video.duration) if str(video.duration).strip() else 0.0
        words = WORD.findall(text)
        questions = sum(1 for s in SENTENCE.findall(text) if "?" in s)
        rows.append({
            "id": video.id, "first_5_seconds": timed_excerpt(video.id, duration, True),
            "last_5_seconds": timed_excerpt(video.id, duration, False), "word_count": len(words),
            "words_per_second": round(len(words) / duration, 2) if duration else "",
            "sentence_count": len(SENTENCE.findall(text)) if text else 0, "question_count": questions,
            "numbers": "; ".join(re.findall(r"\b\d+(?:[.,:]\d+)*\b", text)),
            "names": probable_names(text), "countries": entities(text, COUNTRIES),
            "brands": entities(text, BRANDS),
        })
    pd.DataFrame(rows, columns=FEATURE_FIELDS).to_csv(FEATURES, index=False, encoding="utf-8-sig")
    print(f"Saved {len(rows)} rows to {FEATURES}")


def annotations() -> list[dict]:
    if not ANNOTATIONS.exists():
        raise SystemExit("Нет annotations.jsonl. Запустите annotate.py.")
    return [json.loads(line) for line in ANNOTATIONS.read_text(encoding="utf-8").splitlines() if line.strip()]


def top(items: list[str], limit: int) -> list[tuple[str, int]]:
    return Counter(item for item in items if item and item != "null").most_common(limit)


def title_pattern(title: str) -> str:
    """A deliberately simple pattern so each title stays interpretable in reports."""
    value = title.strip().lower()
    value = re.sub(r"\b\d+(?:[.,:]\d+)*\b", "{N}", value)
    value = re.sub(r"[\"'«»]([^\"'«»]+)[\"'«»]", "{QUOTE}", value)
    value = re.sub(r"\s+", " ", value)
    return value


def report(title: str, rows: list[tuple[str, int]], filename: str) -> None:
    REPORTS.mkdir(exist_ok=True)
    text = f"# {title}\n\nВсего размечено роликов: {len(annotations())}\n\n"
    text += "| # | Паттерн | Роликов |\n| --- | --- | ---: |\n"
    text += "\n".join(f"| {i} | {value} | {count} |" for i, (value, count) in enumerate(rows, 1)) + "\n"
    (REPORTS / filename).write_text(text, encoding="utf-8")


def knowledge_base() -> None:
    items = annotations()
    def field(key: str) -> list[str]: return [x["annotation"].get(key) for x in items]
    report("Top 100 hooks", top(field("hook_type"), 100), "hooks.md")
    report("Top 50 endings", top(field("ending"), 50), "endings.md")
    report("Top 20 story templates", top(field("story_pattern"), 20), "templates.md")
    report("Top 100 title patterns", top([title_pattern(x.get("title", "")) for x in items], 100), "titles.md")
    report("Top 50 topics", top(field("topic"), 50), "topics.md")
    emotions = [emotion for x in items for emotion in x["annotation"].get("emotion", [])]
    report("Top emotional triggers", top(emotions, 50), "emotions.md")
    dna = [x["annotation"].get("content_dna", {}) for x in items]
    skeletons = [" → ".join(key for key in ("hook", "context", "conflict", "escalation", "twist", "resolution", "final_joke") if d.get(key)) for d in dna]
    report("Content DNA skeletons", top(skeletons, 20), "insights.md")
    print(f"Saved knowledge-base reports to {REPORTS}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["features", "knowledge-base"])
    args = parser.parse_args()
    make_features() if args.command == "features" else knowledge_base()


if __name__ == "__main__":
    main()
