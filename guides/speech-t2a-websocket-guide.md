---
title: 'Synchronous Text-to-Speech Guide (WebSocket)'
source: 'https://platform.minimax.io/docs/guides/speech-t2a-websocket'
fetched_at: '2025-10-22T00:00:00Z'
---

# Synchronous Text-to-Speech Guide (WebSocket)

## Overview

Synchronous TTS allows real-time text-to-speech synthesis, handling up to 10,000 characters per request.

## Available Models

The platform offers six speech synthesis models with varying capabilities:

| Model                    | Key Features                                         |
| ------------------------ | ---------------------------------------------------- |
| speech-2.5-hd-preview    | Latest HD model emphasizing similarity and quality   |
| speech-2.5-turbo-preview | New turbo variant supporting 40 languages            |
| speech-02-hd             | Strong rhythm/stability with quality replication     |
| speech-02-turbo          | Multilingual capabilities with excellent performance |
| speech-01-hd             | Rich voices with expressive emotions                 |
| speech-01-turbo          | Excellent performance with low latency               |

## Language Support

The system supports 40 widely used global languages spanning major world regions:

Chinese, Cantonese, English, Spanish, French, Russian, German, Portuguese, Arabic, Italian, Japanese, Korean, Indonesian, Vietnamese, Turkish, Dutch, Ukrainian, Thai, Polish, Romanian, Greek, Czech, Finnish, Hindi, Bulgarian, Danish, Hebrew, Malay, Persian, Slovak, Swedish, Croatian, Filipino, Hungarian, Norwegian, Slovenian, Catalan, Nynorsk, Tamil, and Afrikaans.

## Technical Setup Requirements

- Install MPV player for real-time audio playback
- Set `MINIMAX_API_KEY` environment variable
- WebSocket connection to `wss://api.minimax.io/ws/v1/t2a_v2`

## Implementation Flow

The Python implementation demonstrates:

1. **Connection establishment** with SSL context and Bearer token authorization
2. **Task initialization** specifying model, voice settings (ID, speed, volume, pitch), and audio parameters (sample rate, bitrate, format, channels)
3. **Streaming synthesis** sending text and receiving hexadecimal audio chunks
4. **Real-time playback** via MPV while accumulating data
5. **File persistence** saving complete audio output

## Core Parameters

**Voice Settings:**

- voice_id: "English_expressive_narrator"
- speed: 1
- vol: 1
- pitch: 0
- english_normalization: Boolean option

**Audio Configuration:**

- sample_rate: 32000
- bitrate: 128000
- format: mp3 (configurable)
- channel: 1 (mono)
