"""Fetch captions, falling back to local Whisper when captions are unavailable."""
from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

import pandas as pd
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

ROOT = Path(__file__).resolve().parents[1]
VIDEOS = ROOT / "data" / "videos.csv"
TRANSCRIPTS = ROOT / "data" / "transcripts"


def fetch_captions(video_id: str, languages: list[str]) -> tuple[str, list[dict]]:
    transcript = YouTubeTranscriptApi().fetch(video_id, languages=languages)
    segments = [
        {"text": item.text.strip(), "start": item.start, "duration": item.duration, "source": "captions"}
        for item in transcript if item.text.strip()
    ]
    return " ".join(item["text"] for item in segments), segments


def download_audio(url: str, folder: Path) -> Path:
    """Download the original audio stream; no ffmpeg conversion is required."""
    options = {
        "format": "bestaudio/best", "quiet": True, "noplaylist": True,
        "outtmpl": str(folder / "audio.%(ext)s"),
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=True)
        path = Path(ydl.prepare_filename(info))
    if not path.exists():
        files = list(folder.glob("audio.*"))
        if not files:
            raise FileNotFoundError("yt-dlp did not create an audio file")
        path = files[0]
    return path


def whisper_transcribe(url: str, model_name: str, device: str, compute_type: str) -> tuple[str, list[dict]]:
    try:
        from faster_whisper import WhisperModel
    except ModuleNotFoundError as error:
        raise RuntimeError("Install fallback dependencies: python -m pip install faster-whisper yt-dlp") from error

    with tempfile.TemporaryDirectory(prefix="shorts-audio-") as tmp:
        audio_path = download_audio(url, Path(tmp))
        model = WhisperModel(model_name, device=device, compute_type=compute_type)
        result, _info = model.transcribe(str(audio_path), vad_filter=True)
        segments = [
            {"text": segment.text.strip(), "start": round(segment.start, 3),
             "duration": round(segment.end - segment.start, 3), "source": "whisper"}
            for segment in result if segment.text.strip()
        ]
    if not segments:
        raise RuntimeError("Whisper returned an empty transcript")
    return " ".join(item["text"] for item in segments), segments


def main() -> None:
    parser = argparse.ArgumentParser(description="Captions first; local Whisper fallback second.")
    parser.add_argument("--languages", nargs="+", default=["ru", "en"])
    parser.add_argument("--limit", type=int, help="Maximum number of videos that still need a transcript")
    parser.add_argument("--force", action="store_true", help="Recreate existing transcripts")
    parser.add_argument("--no-whisper", action="store_true", help="Only try YouTube captions")
    parser.add_argument("--whisper-model", default="small", help="faster-whisper model name; default: small")
    parser.add_argument("--device", default="auto", help="Whisper device: auto, cpu, or cuda")
    parser.add_argument("--compute-type", default="int8", help="CTranslate2 compute type; default: int8")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    if not VIDEOS.exists():
        raise SystemExit("Сначала запустите scripts/collect.py")

    TRANSCRIPTS.mkdir(exist_ok=True)
    videos = pd.read_csv(VIDEOS, dtype={"id": str}).fillna("")
    candidates = [(index, row) for index, row in videos.iterrows()
                  if args.force or not (TRANSCRIPTS / f"{row.id}.txt").exists()]
    if args.limit:
        candidates = candidates[:args.limit]

    captions = whisper = failed = 0
    for index, row in candidates:
        try:
            text, segments = fetch_captions(row.id, args.languages)
            source = "captions"
        except Exception as caption_error:
            if args.no_whisper:
                failed += 1
                print(f"{row.id}: captions unavailable ({type(caption_error).__name__})")
                continue
            try:
                text, segments = whisper_transcribe(row.url, args.whisper_model, args.device, args.compute_type)
                source = "whisper"
            except Exception as whisper_error:
                failed += 1
                print(f"{row.id}: captions={type(caption_error).__name__}; whisper={type(whisper_error).__name__}")
                continue

        (TRANSCRIPTS / f"{row.id}.txt").write_text(text, encoding="utf-8")
        (TRANSCRIPTS / f"{row.id}.json").write_text(json.dumps(segments, ensure_ascii=False), encoding="utf-8")
        videos.at[index, "transcript"] = text
        captions += source == "captions"
        whisper += source == "whisper"
        print(f"{row.id}: {source}")

    videos.to_csv(VIDEOS, index=False, encoding="utf-8-sig")
    print(f"Transcripts: {captions} captions, {whisper} Whisper, {failed} failed")


if __name__ == "__main__":
    main()
