"""Collect Shorts metadata into data/videos.csv."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd
import yt_dlp

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
VIDEOS = DATA / "videos.csv"
METADATA = DATA / "metadata"
FIELDS = ["id", "url", "title", "views", "publish_date", "duration", "transcript"]


def normalize(entry: dict) -> dict:
    video_id = entry["id"]
    return {
        "id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "title": entry.get("title", ""),
        "views": entry.get("view_count"),
        "publish_date": entry.get("upload_date") or entry.get("release_date") or "",
        "duration": entry.get("duration"),
        "transcript": "",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("channel_url", nargs="?", help="Например: https://www.youtube.com/@CHANNEL/shorts")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--seed-csv", help="Импортировать ранее собранный CSV (минимум: id, url, title)")
    args = parser.parse_args()
    if not args.channel_url and not args.seed_csv:
        parser.error("Укажите channel_url или --seed-csv")

    DATA.mkdir(exist_ok=True)
    METADATA.mkdir(exist_ok=True)
    rows = []
    if args.seed_csv:
        source = pd.read_csv(args.seed_csv, dtype={"id": str}).fillna("")
        if not {"id", "url", "title"}.issubset(source.columns):
            raise SystemExit("Seed CSV должен содержать столбцы id, url, title")
        for _, item in source.iterrows():
            rows.append({field: item.get(field, "") for field in FIELDS})
    if args.channel_url:
        options = {"quiet": True, "extract_flat": False, "playlistend": args.limit, "skip_download": True}
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(args.channel_url, download=False)
        for entry in info.get("entries", []):
            if not entry or not entry.get("id"):
                continue
            row = normalize(entry)
            rows.append(row)
            (METADATA / f"{row['id']}.json").write_text(
                json.dumps(entry, ensure_ascii=False, default=str, indent=2), encoding="utf-8"
            )

    old = pd.read_csv(VIDEOS, dtype={"id": str}) if VIDEOS.exists() else pd.DataFrame(columns=FIELDS)
    new = pd.DataFrame(rows, columns=FIELDS)
    # Metadata may change, but a fresh collection must never discard a downloaded transcript.
    old = old.set_index("id", drop=False)
    for _, row in new.iterrows():
        if row.id in old.index and str(old.at[row.id, "transcript"]).strip():
            row["transcript"] = old.at[row.id, "transcript"]
        old.loc[row.id, FIELDS] = row[FIELDS]
    combined = old.reset_index(drop=True).reindex(columns=FIELDS)
    combined.to_csv(VIDEOS, index=False, encoding="utf-8-sig")
    print(f"Saved {len(new)} collected / {len(combined)} total videos to {VIDEOS}")


if __name__ == "__main__":
    main()
