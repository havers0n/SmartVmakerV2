import yt_dlp
import pandas as pd

CHANNEL = "https://www.youtube.com/@i11ush/shorts"

ydl_opts = {
    "quiet": True,
    "extract_flat": True,
    "playlistend": 100,
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(CHANNEL, download=False)

rows = []
for entry in info["entries"]:
    rows.append({
        "title": entry.get("title"),
        "url": "https://www.youtube.com/watch?v=" + entry["id"],
        "id": entry["id"],
    })

df = pd.DataFrame(rows)
df.to_csv("i11ush_100_shorts.csv", index=False, encoding="utf-8-sig")

print(df.head())
print(f"Saved {len(df)} videos")