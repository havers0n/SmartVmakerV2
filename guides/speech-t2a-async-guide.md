---
title: 'Async Long TTS Guide'
source: 'https://platform.minimax.io/docs/guides/speech-t2a-async'
fetched_at: '2025-10-22T00:00:00Z'
---

# Async Long TTS Guide

## Overview

MiniMax offers asynchronous text-to-speech capabilities supporting up to 1M characters per request for text input. The service includes 100+ system voices, custom voice cloning, and adjustable parameters for pitch, speech rate, volume, bitrate, and sample rate.

## Key Features

- Timestamp (subtitles) return, accurate to the sentence level
- Two input methods: direct text strings or file uploads via file_id
- Invalid character detection (service generates audio if invalid characters are ≤10%)
- Ideal for synthesizing lengthy content like entire books

## Available Models

Six models are offered, ranging from HD preview versions to turbo variants, with the newest being "speech-2.5-hd-preview" described as having "Ultimate Similarity, Ultra-High Quality."

## Language Support

The platform supports 40 languages including Chinese, English, Spanish, French, Japanese, Korean, Arabic, Hindi, and many others across European, Asian, and African regions.

## Workflow Steps

1. Upload text file (optional) to obtain file_id
2. Create task via Create Speech Generation endpoint
3. Monitor progress using Query Status endpoint
4. Download audio via File Retrieve API (URLs valid for 9 hours (32,400 seconds))

## Technical Parameters

Users can configure audio settings (sample rate, bitrate, format, channels) and voice modifications (pitch, intensity, timbre, sound effects). A pronunciation dictionary enables custom term pronunciation.
