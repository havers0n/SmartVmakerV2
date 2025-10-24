---
title: 'Model Context Protocol (MCP) Guide - Complete Reference'
source: 'https://platform.minimax.io/docs/guides/mcp-guide'
fetched_at: '2025-10-22T00:00:00Z'
---

# Model Context Protocol (MCP) Guide - Complete Reference

## Overview

The Model Context Protocol represents a standardized interface for connecting applications with language models. As described in the documentation, it functions as "a stable and standardized entry point so models can access databases, APIs, plugins, or other tools."

MiniMax offers implementations in both Python and JavaScript, supporting multimodal capabilities including text-to-speech, voice synthesis, image creation, and video production.

---

## MiniMax MCP Tools Reference

### 1. text_to_audio

Converts written content into natural, fluent speech output.

**Key Parameters:**

- `text` (required): Up to 10,000 characters
- `voice_id`: Defaults to "female-shaonv"
- `model`: Defaults to "speech-02-hd"
- `speed`: Range 0.5–2.0 (default: 1.0)
- `emotion`: Options include happy, sad, angry, fearful, disgusted, surprised, calm
- `format`: pcm, mp3, flac, or wav
- `pitch`: Range -12 to 12

### 2. list_voices

Enumerates all accessible voices by type (system, voice_cloning, voice_generation, music_generation, or all).

### 3. voice_clone

Replicates voice characteristics from an audio file.

**Requirements:**

- `voice_id`: 8-256 characters, starts with letter, alphanumeric with hyphens/underscores
- `file`: mp3, m4a, or wav format

### 4. voice_design

Creates a synthesized voice based on descriptive prompts with preview audio generation.

### 5. play_audio

Plays local or remotely hosted audio files.

### 6. music_generation

Produces original compositions from creative prompts and structured lyrics.

**Specifications:**

- Prompt: 10–300 characters
- Lyrics: 10–600 characters, supports structural tags like [Verse], [Chorus], [Bridge]

### 7. generate_video

Creates video content from textual descriptions or images.

**Model Options:**

- MiniMax-Hailuo-02
- T2V-01-Director, I2V-01-Director series
- Duration: 6–10 seconds (varies by model)
- Resolution: 512P–1080P

### 8. image_to_video

(JavaScript/TypeScript only) Generates motion video from static images with optional narrative direction.

### 9. query_video_generation

Retrieves status and results from asynchronous video generation tasks using task identifiers.

### 10. text_to_image

Produces visual content from written descriptions.

**Parameters:**

- Prompt: Maximum 1,500 characters
- Models: "image-01" or "image-01-live"
- Aspect ratios: 1:1, 16:9, 4:3, 3:2, 2:3, 3:4, 9:16, 21:9
- Output quantity: 1–9 images per request

---

## Setup & Configuration

### API Key Acquisition

Access the MiniMax Developer Platform to create credentials. The system displays keys only once; secure storage is essential.

### Python Implementation (MiniMax-MCP)

**Installation requires `uv`:**

macOS/Linux:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Windows:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Transport Methods:**

- `stdio`: Local execution via standard input/output
- `SSE`: Server-sent events for distributed deployment

### JavaScript Implementation (MiniMax-MCP-JS)

Requires Node.js and npm installation. Verify via `node -v` and `npm -v`.

**Transport Methods:**

- `stdio`: Local integration
- `REST`: HTTP-based API calls
- `SSE`: Event streaming

---

## Client Integration

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "MiniMax": {
      "command": "uvx",
      "args": ["minimax-mcp"],
      "env": {
        "MINIMAX_API_KEY": "your-key",
        "MINIMAX_MCP_BASE_PATH": "/path/to/output",
        "MINIMAX_API_HOST": "https://api.minimax.io",
        "MINIMAX_API_RESOURCE_MODE": "url"
      }
    }
  }
}
```

### Cursor Integration

Navigate to Preferences → Tools & Integrations → MCP and add custom configuration through `mcp.json`.

### Cherry Studio Integration

Use Settings → MCP Settings → Add Server → Import from JSON with appropriate environment variables.

---

## Environment Variables

| Variable                    | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `MINIMAX_API_KEY`           | Authentication credential                      |
| `MINIMAX_MCP_BASE_PATH`     | Output directory for generated files           |
| `MINIMAX_API_HOST`          | API endpoint (default: https://api.minimax.io) |
| `MINIMAX_API_RESOURCE_MODE` | Resource exposure method (url or local)        |

---

## Contributing

Community contributions are welcomed through:

1. Opening issues describing proposals or problems
2. Submitting pull requests after feedback
3. Participating in code review processes

Repository links: [Python](https://github.com/MiniMax-AI/MiniMax-MCP) | [JavaScript](https://github.com/MiniMax-AI/MiniMax-MCP-JS)
