---
title: 'Video Generation Guide'
source: 'https://platform.minimax.io/docs/guides/video-generation'
fetched_at: '2025-10-22T00:00:00Z'
---

# Video Generation Guide

## Overview

MiniMax provides video generation capabilities through an asynchronous API service. The platform supports multiple generation modes to create dynamic video content efficiently.

## Supported Generation Modes

The API offers four distinct approaches:

1. **Text-to-Video**: Generate a video directly from a text description
2. **Image-to-Video**: Generate a video based on an initial image combined with a text description
3. **First-and-Last-Frame Video**: Create videos by specifying both opening and closing frames
4. **Subject-Reference Video**: Generate a video using a subject's face photo and a text description, ensuring consistency of facial features throughout the video

## Workflow Architecture

Video generation follows a three-step asynchronous process:

1. Submit a generation request and receive a unique task identifier
2. Poll the task status endpoint until processing completes
3. Download the generated video using the returned file identifier

## API Endpoints

**Task Creation**: `POST https://api.minimax.io/v1/video_generation`

**Status Polling**: `GET https://api.minimax.io/v1/query/video_generation`

**File Retrieval**: `GET https://api.minimax.io/v1/files/retrieve`

## Request Parameters

### Text-to-Video Mode

- `prompt`: Scene description with optional motion cues like [pan], [zoom], [static]
- `model`: "MiniMax-Hailuo-02"
- `duration`: Video length in seconds (example: 6)
- `resolution`: Output quality ("1080P")

### Image-to-Video Mode

- `prompt`: Evolution description from the starting image
- `first_frame_image`: URL to the initial frame
- `model`: "MiniMax-Hailuo-02"
- `duration`: Video length specification
- `resolution`: Output quality setting

### Subject-Reference Mode

- `prompt`: Action description for the subject
- `subject_reference`: Array containing character type and face image URLs
- `model`: "S2V-01"
- `duration`: Video length
- `resolution`: Output specification

## Response Structure

**Task Creation Response**: Returns `task_id` for status tracking

**Status Query Response**: Provides current `status` ("Success" or "Fail") and `file_id` upon completion

**File Retrieval Response**: Contains `download_url` for video file access

## Implementation Notes

- Polling interval recommendation: 10-second intervals between status checks
- Authentication: Bearer token via "Authorization" header using API key
- All endpoints require JSON request format with appropriate headers
