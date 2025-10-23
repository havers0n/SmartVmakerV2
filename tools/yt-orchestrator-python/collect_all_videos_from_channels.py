import os, re, json, time
import pandas as pd
from tqdm import tqdm
from googleapiclient.discovery import build

# ==== КЛЮЧ ====
YOUTUBE_API_KEY = "AIzaSyAtXokVeRVLVY_L4LjT4_VWiEi4_mAqQLM"

# ==== НАСТРОЙКИ ====
INPUT_CHANNELS_CSV = "channels.csv"
OUT_DIR = "dataset"
os.makedirs(f"{OUT_DIR}/index", exist_ok=True)
os.makedirs(f"{OUT_DIR}/channels", exist_ok=True)
os.makedirs(f"{OUT_DIR}/videos", exist_ok=True)

youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)

# --- utils ---
def extract_channel_id_from_url(url: str):
    # /channel/UCxxxxxx → сразу вернём ID
    m = re.search(r"/channel/(UC[0-9A-Za-z_-]{22})", url)
    if m: return m.group(1)
    return None

def resolve_channel_id_any(url_or_handle: str):
    # 1) если это прямой UC-id
    cid = extract_channel_id_from_url(url_or_handle)
    if cid:
        return cid

    # 2) пробуем "handle": @name → search.list (type=channel)
    handle = None
    m = re.search(r"youtube\.com/@([^/?#]+)", url_or_handle)
    if m: handle = m.group(1)

    query = handle or url_or_handle
    resp = youtube.search().list(
        part="snippet",
        q=query,
        type="channel",
        maxResults=1
    ).execute()
    items = resp.get("items", [])
    if items:
        return items[0]["snippet"]["channelId"]

    # 3) custom /c/... тоже поймается в search
    return None

def fetch_channel_meta(channel_id: str):
    r = youtube.channels().list(
        part="snippet,contentDetails,statistics",
        id=channel_id
    ).execute()
    if not r.get("items"):
        return None, None
    c = r["items"][0]
    meta = {
        "channel_id": c["id"],
        "title": c["snippet"]["title"],
        "description": c["snippet"].get("description",""),
        "publishedAt": c["snippet"]["publishedAt"],
        "subscribers": int(c["statistics"].get("subscriberCount", 0)),
        "videos_total": int(c["statistics"].get("videoCount", 0)),
        "views_total": int(c["statistics"].get("viewCount", 0)),
    }
    uploads_pl = c["contentDetails"]["relatedPlaylists"]["uploads"]
    return meta, uploads_pl

def fetch_all_playlist_items(playlist_id: str):
    out = []
    page_token = None
    while True:
        r = youtube.playlistItems().list(
            part="contentDetails",
            playlistId=playlist_id,
            maxResults=50,
            pageToken=page_token
        ).execute()
        for it in r.get("items", []):
            cd = it["contentDetails"]
            out.append(cd["videoId"])
        page_token = r.get("nextPageToken")
        if not page_token:
            break
        time.sleep(0.05)
    return out

def fetch_videos_meta(video_ids):
    result = []
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        r = youtube.videos().list(
            part="snippet,contentDetails,statistics",
            id=",".join(batch)
        ).execute()
        result.extend(r.get("items", []))
        time.sleep(0.05)
    return result

def parse_duration_iso(dur):
    import isodate
    try: return int(isodate.parse_duration(dur).total_seconds())
    except: return None

# --- main ---
def main():
    df = pd.read_csv(INPUT_CHANNELS_CSV, encoding="utf-8-sig")
    if "channel" not in df.columns:
        raise RuntimeError(f"В {INPUT_CHANNELS_CSV} должна быть колонка 'channel'")

    all_rows = []
    for row in tqdm(df["channel"], desc="Resolve channels"):
        cid = resolve_channel_id_any(str(row))
        if not cid:
            print(f"⚠ Не смог получить channel_id для: {row}")
            continue

        meta, uploads_pl = fetch_channel_meta(cid)
        if not uploads_pl:
            print(f"⚠ Нет uploads-плейлиста для: {cid}")
            continue

        # сохраняем метаданные канала
        with open(f"{OUT_DIR}/channels/{cid}.json","w",encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        # получаем все video_id из uploads
        vids = fetch_all_playlist_items(uploads_pl)

        # тянем базовую инфу по видео (название, дата, просмотры)
        videos_meta = fetch_videos_meta(vids)
        for v in videos_meta:
            sn, st, cd = v["snippet"], v.get("statistics", {}), v.get("contentDetails", {})
            video_row = {
                "channel_id": sn["channelId"],
                "channel_title": sn["channelTitle"],
                "video_id": v["id"],
                "watch_url": f"https://www.youtube.com/watch?v={v['id']}",
                "shorts_url": f"https://www.youtube.com/shorts/{v['id']}",
                "title": sn.get("title",""),
                "publishedAt": sn.get("publishedAt",""),
                "views": int(st.get("viewCount",0)),
                "likes": int(st.get("likeCount",0)),
                "comments": int(st.get("commentCount",0)),
                "duration_s": parse_duration_iso(cd.get("duration","")),
                "categoryId": sn.get("categoryId","")
            }
            # сохраним пер-видео мету при желании:
            with open(f"{OUT_DIR}/videos/{v['id']}.json","w",encoding="utf-8") as f:
                json.dump(video_row, f, ensure_ascii=False, indent=2)

            all_rows.append(video_row)

    out_df = pd.DataFrame(all_rows)
    out_df.to_csv(f"{OUT_DIR}/index/videos_index.csv", index=False, encoding="utf-8-sig")
    print(f"✅ Готово: {OUT_DIR}/index/videos_index.csv (всего видео: {len(out_df)})")

if __name__ == "__main__":
    main()
