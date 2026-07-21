"""Annotate transcripts with a JSON schema via the OpenAI Responses API."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / "data" / "videos.csv"
OUTPUT = ROOT / "data" / "annotations" / "annotations.jsonl"
PROMPT = (ROOT / "prompts" / "annotation.md").read_text(encoding="utf-8")


def existing_ids() -> set[str]:
    if not OUTPUT.exists():
        return set()
    return {json.loads(line)["video_id"] for line in OUTPUT.read_text(encoding="utf-8").splitlines() if line.strip()}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="gpt-4.1-mini")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()
    if not VIDEOS.exists():
        raise SystemExit("Сначала запустите scripts/collect.py и scripts/transcribe.py")

    done = set() if args.force else existing_ids()
    client = OpenAI()
    videos = pd.read_csv(VIDEOS, dtype={"id": str}).fillna("")
    pending = videos[(videos.transcript.str.len() > 0) & ~videos.id.isin(done)]
    if args.limit:
        pending = pending.head(args.limit)
    OUTPUT.parent.mkdir(exist_ok=True)
    mode = "w" if args.force else "a"
    with OUTPUT.open(mode, encoding="utf-8") as stream:
        for _, video in pending.iterrows():
            response = client.responses.create(
                model=args.model,
                instructions=PROMPT,
                input=(f"Название: {video.title}\nДлительность: {video.duration} сек.\n"
                       f"Транскрипт:\n{video.transcript}"),
            )
            try:
                annotation = json.loads(response.output_text.strip().removeprefix("```json").removesuffix("```"))
            except json.JSONDecodeError as error:
                print(f"{video.id}: invalid JSON, skipped ({error})")
                continue
            stream.write(json.dumps({"video_id": video.id, "url": video.url, "title": video.title,
                                     "annotation": annotation}, ensure_ascii=False) + "\n")
            stream.flush()
            print(f"Annotated {video.id}")


if __name__ == "__main__":
    main()
