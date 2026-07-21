"""Compose a generator prompt from ranked knowledge-base reports."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = (ROOT / "prompts" / "generator.md").read_text(encoding="utf-8")


def ranked_value(filename: str, number: int) -> str:
    path = ROOT / "reports" / filename
    if not path.exists():
        raise SystemExit("Сначала выполните: python scripts/analyze.py knowledge-base")
    rows = [line for line in path.read_text(encoding="utf-8").splitlines() if line.startswith("|")][2:]
    if not 1 <= number <= len(rows):
        raise SystemExit(f"В {filename} нет элемента №{number}")
    cells = [cell.strip() for cell in rows[number - 1].strip("|").split("|")]
    return cells[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", required=True)
    parser.add_argument("--duration", required=True, type=int)
    parser.add_argument("--structure", required=True, type=int)
    parser.add_argument("--hook", required=True, type=int)
    parser.add_argument("--ending", required=True, type=int)
    parser.add_argument("--output", default="")
    args = parser.parse_args()
    prompt = TEMPLATE.format(topic=args.topic, duration=args.duration,
                             story_pattern=ranked_value("templates.md", args.structure),
                             hook_type=ranked_value("hooks.md", args.hook),
                             ending=ranked_value("endings.md", args.ending))
    if args.output:
        Path(args.output).write_text(prompt, encoding="utf-8")
    else:
        print(prompt)


if __name__ == "__main__":
    main()
