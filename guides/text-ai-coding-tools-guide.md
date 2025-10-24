---
title: 'M1 for AI Coding Tools Guide'
source: 'https://platform.minimax.io/docs/guides/text-ai-coding-tools'
fetched_at: '2025-10-22T00:00:00Z'
---

# M1 for AI Coding Tools Guide

## Overview

MiniMax-M1 features strong code understanding, multi-turn dialogue, and reasoning capabilities. The model integrates with the OpenAI API protocol, making it suitable for deployment in code assistants, agent tools, and AI-powered IDEs. This documentation covers implementation in Cursor and Cline.

## API Key Acquisition

To begin using MiniMax-M1:

1. Access the MiniMax Developer Platform interface
2. Generate a new secret key by selecting the creation option and providing a project identifier
3. **Important**: Copy and securely store the API key immediately, as it displays only once and cannot be retrieved later

## Cursor Integration

### Installation and Setup

1. Download Cursor from the official website
2. Launch the application and navigate to Settings via the top-right menu
3. Authenticate your Cursor account using the Sign in option

### API Configuration Steps

1. Open the Models section in the left sidebar
2. Expand API Keys configuration:
   - Enable "Override OpenAI Base URL"
   - Input the MiniMax endpoint: `https://api.minimax.io/v1`
   - Paste your API key into the OpenAI API Key field

3. Click Verify and enable the OpenAI API Key when prompted
4. Add a custom model with the identifier "MiniMax-M1"
5. Activate the newly added model

### Usage Example

Select MiniMax-M1 from the chat panel dropdown. The model successfully generated a maze generator with A\* pathfinding visualization using canvas and animations.

## Cline Integration

### Extension Installation

1. Open VS Code and access the Extensions marketplace
2. Search for and install the Cline extension
3. Restart VS Code if needed; the Cline icon will appear in the activity bar

### API Configuration

1. Select "Use your own API key" to access settings
2. Choose "OpenAI Compatible" as the API Provider
3. Configure:
   - **Base URL**: `https://api.minimax.io/v1`
   - **API Key**: Your MiniMax credential
   - **Model ID**: `MiniMax-M1`

4. Complete setup by clicking "Let's go!" and confirming with Done

### Operational Setup

Enable the Edit option in the Auto-approve section for autonomous modifications during task execution.

## Key Technical Details

- **Protocol Compatibility**: OpenAI API standard
- **Service Endpoint**: `https://api.minimax.io/v1`
- **Default Model Identifier**: MiniMax-M1
- **Primary Use Cases**: Code understanding, multi-turn reasoning, collaborative development tasks

Both tools demonstrated capability in generating sophisticated web applications with animations and interactive features through natural language prompts.
