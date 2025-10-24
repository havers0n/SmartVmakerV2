---
title: 'Video Generation with Templates Guide'
source: 'https://platform.minimax.io/docs/guides/video-agent'
fetched_at: '2025-10-22T00:00:00Z'
---

# Video Generation with Templates Guide

## Overview

The Video Agent generation service enables rapid video creation with consistent styling through template-based workflows. Users populate predefined templates with assets like images and text to generate customized videos.

## Process Workflow

Template-based video generation operates asynchronously across three phases:

1. **Task Submission**: Submit a template generation request specifying a `template_id` and associated assets, receiving a `task_id` in response
2. **Status Monitoring**: Poll task progress using the `task_id`. Upon completion, the API returns a downloadable `video_url`
3. **Video Retrieval**: Download and save the generated video file locally

For additional templates, consult the Video Agent Template List documentation.

## Implementation Example: "Run for Life" Video Generation

### Code Structure

The implementation comprises three functional components:

**Task Submission Function**

```python
def invoke_template_task() -> str:
    url = "https://api.minimax.io/v1/video_template_generation"
    payload = {
        "template_id": "393769180141805569",
        "media_inputs": [
            {
                "value": "https://cdn.hailuoai.com/prod/2024-09-18-16/user/multi_chat_file/9c0b5c14-ee88-4a5b-b503-4f626f018639.jpeg"
            }
        ],
        "text_inputs": [{"value": "Lion"}],
    }
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    task_id = response.json()["task_id"]
    return task_id
```

**Status Polling Function**

```python
def query_task_status(task_id: str):
    url = "https://api.minimax.io/v1/query/video_template_generation"
    params = {"task_id": task_id}
    while True:
        time.sleep(10)
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        response_json = response.json()
        status = response_json["status"]
        print(f"Current task status: {status}")
        if status == "Success":
            return response_json["video_url"]
        elif status == "Fail":
            raise Exception(f"Video generation failed: {response_json}")
```

**Video Download Function**

```python
def save_video_from_url(video_url: str):
    print(f"Downloading video from {video_url}...")
    response = requests.get(video_url)
    response.raise_for_status()
    with open("output.mp4", "wb") as f:
        f.write(response.content)
    print("Video successfully saved as output.mp4")
```

**Main Execution Flow**

```python
if __name__ == "__main__":
    task_id = invoke_template_task()
    print(f"Video generation task submitted successfully, task_id: {task_id}")
    final_video_url = query_task_status(task_id)
    print(f"Task completed successfully, video URL: {final_video_url}")
    save_video_from_url(final_video_url)
```

### API Endpoints

- **Generation**: `https://api.minimax.io/v1/video_template_generation` (POST)
- **Status Query**: `https://api.minimax.io/v1/query/video_template_generation` (GET)

### Payload Structure

The generation request accepts:

- `template_id`: Identifier for the selected template
- `media_inputs`: Array containing image/video asset URLs
- `text_inputs`: Array containing text values for template placeholders

### Response Details

Success responses include a `video_url` field providing direct download access. Status responses contain a `status` field indicating task progress ("Success" or "Fail").
