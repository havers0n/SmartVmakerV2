import os, re, json, time, random
import pandas as pd
from tqdm import tqdm
import requests

# ==== КЛЮЧ ====
GEMINI_API_KEY = "AIzaSyAwCho2vBrtTQo8YdZHTF9BgcuXMICY4FU"

# ==== НАСТРОЙКИ ====
OUT_DIR = "dataset"
INDEX_CSV = f"{OUT_DIR}/index/videos_index.csv"
FRAMES_DIR = f"{OUT_DIR}/frames"
MASTER_PATH = f"{OUT_DIR}/master_frames.ndjson"
os.makedirs(FRAMES_DIR, exist_ok=True)

# --- utils ---
VID_RE = re.compile(r"(?:v=|shorts/)([A-Za-z0-9_-]{11})")
def extract_video_id(url: str):
    m = VID_RE.search(url or "");  return m.group(1) if m else None

def to_watch_url(any_url: str):
    vid = extract_video_id(any_url)
    return f"https://www.youtube.com/watch?v={vid}" if vid else any_url

def extract_json_from_text(text: str):
    import json, re
    if text is None: raise ValueError("Empty")
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, flags=re.S)
    if m: return json.loads(m.group(1))
    m = re.search(r"```\s*(\{.*?\})\s*```", text, flags=re.S)
    if m: return json.loads(m.group(1))
    return json.loads(text)

def ask_gemini_timeline(watch_url: str, model_name: str = "gemini-2.5-pro", timeout=120):
    """
    Просим посекундный (или дробно-секундный) таймлайн.
    Для коротких шортов достаточно 0.5–1.0с шаг.
    """
    endpoint = f"https://generativelanguage.googleapis.com/v1/models/{model_name}:generateContent"
    headers = {"Content-Type": "application/json"}

    # Чёткий промпт с форматом
    prompt = (
        "You are a video analyst. Watch the YouTube video and output STRICT JSON ONLY.\n"
        "Return this structure:\n"
        "{\n"
        '  "fps": 1,\n'
        '  "timeline": [\n'
        '     {"t": 0.0, "shot":"wide/medium/close", "objects":["..."], "action":"...", "text_on_screen":"...", "cam":"static/pan/zoom", "emotion":"..."},\n'
        '     {"t": 1.0, ...},\n'
        "     ...\n"
        "  ],\n"
        '  "beats": [ {"time_s": 0.0, "role":"HOOK/BUILD/PAYOFF/RESOLUTION", "desc":"...","emotion":"..."} ],\n'
        '  "summary": "one-paragraph concise summary"\n'
        "}\n\n"
        "Constraints:\n"
        "- JSON only. No markdown, no comments.\n"
        "- timeline step ~1.0s; if shot changes within a second, duplicate entries with fractional t (e.g., 2.5).\n"
        "- Keep `objects` short noun phrases.\n"
        "- `emotion` is coarse (e.g., shock, joy, sadness, tension, awe).\n"
        f"\nVideo: {watch_url}\n"
    )

    payload = {"contents": [{"role":"user","parts":[{"text": prompt}]}]}
    resp = requests.post(f"{endpoint}?key={GEMINI_API_KEY}", headers=headers, json=payload, timeout=timeout)
    return resp

def analyze_video(video_id: str, url: str):
    out_base = f"{FRAMES_DIR}/{video_id}"
    # если уже есть, пропускаем
    for ext in (".json",".txt","_raw.json"):
        if os.path.exists(out_base+ext):
            return True

    watch = to_watch_url(url)

    # 1) пробуем pro → при лимитах/ошибках fallback на flash
    models = [("gemini-2.5-pro", 2), ("gemini-2.5-flash", 2)]
    delay = 3.0
    for model, tries in models:
        for attempt in range(1, tries+1):
            resp = ask_gemini_timeline(watch, model_name=model)
            if resp.status_code == 200:
                data = resp.json()
                # достанем текст
                try:
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                except Exception:
                    with open(out_base+"_raw.json","w",encoding="utf-8") as f:
                        json.dump(data,f,ensure_ascii=False,indent=2)
                    time.sleep(1.2 + random.random()*1.8)
                    return True
                # попробуем распарсить JSON
                try:
                    parsed = extract_json_from_text(text)
                    with open(out_base+".json","w",encoding="utf-8") as f:
                        json.dump(parsed,f,ensure_ascii=False,indent=2)
                    time.sleep(1.2 + random.random()*1.8)
                    return True
                except Exception:
                    with open(out_base+".txt","w",encoding="utf-8") as f:
                        f.write(text)
                    time.sleep(1.2 + random.random()*1.8)
                    return True

            # сохраняем тело ошибки
            with open(out_base+f"_error_{model}_{resp.status_code}.json","w",encoding="utf-8") as f:
                f.write(resp.text)

            if resp.status_code in (429,500,502,503,504):
                time.sleep(delay + random.random()*2.0)
                delay *= 1.7
                continue
            else:
                break  # другие коды — смысла долбить нет
    return False

def main():
    df = pd.read_csv(INDEX_CSV, encoding="utf-8-sig")
    assert "video_id" in df.columns and "watch_url" in df.columns, "Нет колонок video_id/watch_url"
    ok, fail = 0, 0
    for _, row in tqdm(df.iterrows(), total=len(df), desc="Gemini frame analysis"):
        vid, url = row["video_id"], row["watch_url"]
        if analyze_video(vid, url):
            ok += 1
        else:
            fail += 1
    print(f"✅ OK: {ok}  ❌ FAIL: {fail}")

    # Собираем master_frames.ndjson (meta + frames-json ref)
    with open(MASTER_PATH,"w",encoding="utf-8") as out:
        for _, row in df.iterrows():
            vid = row["video_id"]
            frames_ref = None
            base = f"{FRAMES_DIR}/{vid}"
            if os.path.exists(base+".json"): frames_ref = f"frames/{vid}.json"
            elif os.path.exists(base+"_raw.json"): frames_ref = f"frames/{vid}_raw.json"
            elif os.path.exists(base+".txt"): frames_ref = f"frames/{vid}.txt"

            rec = {
                "video_meta": {
                    "video_id": vid,
                    "watch_url": row["watch_url"],
                    "channel_id": row["channel_id"],
                    "channel_title": row["channel_title"],
                    "title": row["title"],
                    "publishedAt": row["publishedAt"],
                    "views": int(row.get("views",0)),
                    "likes": int(row.get("likes",0)),
                    "comments": int(row.get("comments",0)),
                    "duration_s": int(row.get("duration_s",0)),
                    "categoryId": str(row.get("categoryId",""))
                },
                "frames": {"frames_ref": frames_ref}
            }
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"📄 Master written: {MASTER_PATH}")

if __name__ == "__main__":
    main()
