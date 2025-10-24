---
title: 'Voice Clone Guide'
source: 'https://platform.minimax.io/docs/guides/speech-voice-clone'
fetched_at: '2025-10-22T00:00:00Z'
---

# Voice Clone Guide

## Overview

MiniMax's speech models provide robust voice cloning capabilities, allowing you to synthesize preview audio using cloned voices.

## Workflow Steps

### 1. Upload Source Audio

Upload the audio file to clone via the File Upload API to obtain a `file_id`.

**File Requirements:**

- Formats: mp3, m4a, wav
- Duration: 10 seconds minimum, 5 minutes maximum
- Size: up to 20 MB

**Python Example:**

```python
import requests
import os

api_key = os.getenv("MINIMAX_API_KEY")
url = "https://api.minimax.io/v1/files/upload"
payload = {"purpose": "voice_clone"}
files = [("file", ("clone_input.mp3", open("/path/to/file.mp3", "rb")))]
headers = {"Authorization": f"Bearer {api_key}"}
response = requests.post(url, headers=headers, data=payload, files=files)
file_id = response.json().get("file", {}).get("file_id")
```

**cURL Example:**

```bash
curl --location 'https://api.minimax.io/v1/files/upload' \
--header 'Authorization: Bearer ${MINIMAX_API_KEY}' \
--form 'purpose="voice_clone"' \
--form 'file=@"/path/to/clone_input.mp3"'
```

### 2. Upload Example Audio (Optional)

Upload reference audio to enhance cloning quality via the File Upload API.

**File Requirements:**

- Formats: mp3, m4a, wav
- Duration: less than 8 seconds
- Size: up to 20 MB

**Python Example:**

```python
api_key = os.getenv("MINIMAX_API_KEY")
url = "https://api.minimax.io/v1/files/upload"
payload = {"purpose": "prompt_audio"}
files = [("file", ("clone_prompt.mp3", open("/path/to/file.mp3", "rb")))]
headers = {"Authorization": f"Bearer {api_key}"}
response = requests.post(url, headers=headers, data=payload, files=files)
prompt_file_id = response.json().get("file", {}).get("file_id")
```

**cURL Example:**

```bash
curl --location 'https://api.minimax.io/v1/files/upload' \
--header 'Authorization: Bearer ${MINIMAX_API_KEY}' \
--form 'purpose="prompt_audio"' \
--form 'file=@"/path/to/clone_prompt.mp3"'
```

### 3. Clone the Voice

Call the Voice Clone API with obtained file IDs and custom voice ID.

**Python Example:**

```python
api_key = os.getenv("MINIMAX_API_KEY")
url = "https://api.minimax.io/v1/voice_clone"

payload = {
    "file_id": <file_id_of_cloned_voice>,
    "voice_id": "<your_custom_voice_id>",
    "clone_prompt": {
        "prompt_audio": <file_id_of_prompt_audio>,
        "prompt_text": "This voice sounds natural and pleasant."
    },
    "text": "A gentle breeze passes over the soft grass, accompanied by the fresh scent and birdsong.",
    "model": "speech-2.5-hd-preview"
}

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

response = requests.post(url, headers=headers, json=payload)
```

**cURL Example:**

```bash
curl --location 'https://api.minimax.io/v1/voice_clone' \
--header 'Authorization: Bearer ${MINIMAX_API_KEY}' \
--header 'Content-Type: application/json' \
--data '{
    "file_id": <file_id_of_cloned_voice>,
    "voice_id": "<your_custom_voice_id>",
    "clone_prompt": {
      "prompt_audio": <file_id_of_prompt_audio>,
      "prompt_text": "This voice sounds natural and pleasant."
    },
    "text": "A gentle breeze passes over the soft grass...",
    "model": "speech-2.5-hd-preview"
}'
```

## API Request Parameters

| Parameter      | Type   | Description                                   |
| -------------- | ------ | --------------------------------------------- |
| `file_id`      | string | File ID of source audio from step 1           |
| `voice_id`     | string | Custom voice identifier for future use        |
| `clone_prompt` | object | Optional enhancement parameters               |
| `prompt_audio` | string | File ID of example audio (optional)           |
| `prompt_text`  | string | Description of the voice characteristics      |
| `text`         | string | Content to synthesize with cloned voice       |
| `model`        | string | Model version (e.g., "speech-2.5-hd-preview") |

## Subsequent API Usage

Once a voice is cloned, use the generated `voice_id` with synthesis APIs:

- T2A API
- T2A Async API
