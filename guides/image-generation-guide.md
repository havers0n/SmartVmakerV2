---
title: 'Image Generation Guide'
source: 'https://platform.minimax.io/docs/guides/image-generation'
fetched_at: '2025-10-22T00:00:00Z'
---

# Image Generation Guide

## Overview

The Image Generation service offers two primary functions: **Text-to-Image** and **Image-to-Image** capabilities for creating images from descriptions or reference materials.

## Text-to-Image Generation

This feature enables image creation from detailed text prompts specifying desired visual content.

### Code Example

```python
import base64
import requests
import os

url = "https://api.minimax.io/v1/image_generation"
api_key = os.environ["MINIMAX_API_KEY"]
headers = {"Authorization": f"Bearer {api_key}"}

payload = {
    "model": "image-01",
    "prompt": "men Dressing in white t shirt, full-body stand front view image :25, outdoor, Venice beach sign, full-body image, Los Angeles, Fashion photography of 90s, documentary, Film grain, photorealistic",
    "aspect_ratio": "16:9",
    "response_format": "base64",
}

response = requests.post(url, headers=headers, json=payload)
response.raise_for_status()

images = response.json()["data"]["image_base64"]

for i in range(len(images)):
    with open(f"output-{i}.jpeg", "wb") as f:
        f.write(base64.b64decode(images[i]))
```

### Key Parameters

- `model`: "image-01"
- `prompt`: Detailed text description
- `aspect_ratio`: "16:9"
- `response_format`: "base64"

## Image-to-Image Generation

This capability allows users to supply reference images alongside text prompts to generate new images maintaining key subject characteristics. This is particularly useful for scenarios that require consistent visual identity, such as generating images of the same virtual character in different contexts.

### Code Example

```python
import base64
import requests
import os

url = "https://api.minimax.io/v1/image_generation"
api_key = os.environ["MINIMAX_API_KEY"]
headers = {"Authorization": f"Bearer {api_key}"}

payload = {
    "model": "image-01",
    "prompt": "A girl stands by the library window, gazing into the distance",
    "aspect_ratio": "16:9",
    "subject_reference": [
        {
            "type": "character",
            "image_file": "https://cdn.hailuoai.com/prod/2025-08-12-17/video_cover/1754990600020238321-411603868533342214-cover.jpg",
        }
    ],
    "response_format": "base64",
}

response = requests.post(url, headers=headers, json=payload)
response.raise_for_status()
images = response.json()["data"]["image_base64"]

for i in range(len(images)):
    with open(f"output-{i}.jpeg", "wb") as f:
        f.write(base64.b64decode(images[i]))
```

### Key Parameters

- `subject_reference`: Array containing reference image objects
- `type`: "character"
- `image_file`: URL to reference image
