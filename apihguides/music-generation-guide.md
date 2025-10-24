---
title: 'Music Generation Guide'
source: 'https://platform.minimax.io/docs/guides/music-generation'
fetched_at: '2025-10-22T00:00:00Z'
---

# Music Generation API Guide

## Overview

The Music Generation API enables the creation of complete songs with vocals using text descriptions and lyrical content. This capability supports rapid production of theme songs for various media applications.

## API Endpoint

**URL:** `https://api.minimax.io/v1/music_generation`

**Authentication:** Bearer token via `Authorization` header using the `MINIMAX_API_KEY` environment variable

## Core Parameters

- **model:** `music-1.5`
- **prompt:** Descriptive text defining musical characteristics (style, mood, setting, emotional tone)
- **lyrics:** Vocal content structured with song sections like verses and choruses

## Audio Configuration Settings

The `audio_setting` object allows customization:

- **sample_rate:** 44100 Hz
- **bitrate:** 256000 bps
- **format:** mp3

## Response Format

The API returns audio data as hexadecimal encoding within the response JSON structure under `data.audio`, which can be converted to binary and written as an audio file.

## Use Cases

This feature suits applications requiring unique background music, game soundtracks, or video theme creation without traditional music production workflows.

## Code Implementation

The provided Python example demonstrates the complete workflow: setting authentication headers, constructing the payload, submitting the request, and saving the generated audio file locally.
