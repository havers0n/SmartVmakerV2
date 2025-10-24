---
title: 'Speech Model Evaluation Guide - MiniMax Standards'
source: 'https://platform.minimax.io/docs/guides/speech-evaluate'
fetched_at: '2025-10-22T00:00:00Z'
---

# Speech Model Evaluation Guide - MiniMax Standards

## Overview

The document presents comprehensive evaluation frameworks for speech synthesis models, specifically addressing voice cloning, multilingual capabilities, and emotion control.

## Core Evaluation Metrics

### 1. Task Completion

"Word Error Rate (WER) is a key metric, computed by converting synthesized speech into text via" ASR, then comparing outputs against reference text to identify substitution, insertion, and deletion errors.

### 2. Voice Similarity

The evaluation "extracts embeddings from both synthesized and reference audio, then computing cosine similarity between the embeddings" to assess speaker characteristic preservation.

### 3. Perceptual Quality

"PESQ is a standard objective metric that compares the synthesized audio against a high-quality reference, approximating human auditory perception."

### 4. Intelligibility

"STOI is an established objective metric for intelligibility, quantifying how well listeners can comprehend sentence-level content."

### 5. Subjective Assessment Methods

Two primary approaches are employed:

- **ELO Rating**: "Pairwise A/B tests are conducted, where listeners select preferred samples. Scores are updated using the ELO formula to reflect relative preference."

- **CMOS (Comparative MOS)**: Listeners evaluate quality differences between audio samples in A/B comparisons, with averaged scores indicating relative model performance.

### 6. Instruction Compliance

This metric "assesses whether the model follows input constraints when generating speech, including emotion control and timbre specification."

### 7. Operational Metrics

- **Cost**: Per-call expenses and usage frequency considerations
- **Latency**: "First-packet latency is a key metric, defined as the interval from receiving the full input to generating the first playable audio frame."

## Evaluation Scenarios

The framework addresses five distinct application contexts:

1. **Voice Cloning** - Replicating speaker timbre, intonation, and style under zero/few-shot conditions
2. **Multilingual Generation** - Consistent performance across languages with appropriate pronunciation
3. **Cross-Lingual Synthesis** - Voice transfer across languages while maintaining timbre consistency
4. **Emotion Control** - Synthesizing specified emotional tones while preserving naturalness
5. **Text-Driven Voice Creation** - Generating novel timbres from natural language descriptions

## MiniMax Speech-02 Performance

The model demonstrates "low WER and high SIM, indicating strong cloning fidelity" in both Chinese and English voice cloning tasks, supports "32 languages with high accuracy and strong similarity preservation," and shows "strong cross-lingual ability, generating speech in other languages from short audio clips."
