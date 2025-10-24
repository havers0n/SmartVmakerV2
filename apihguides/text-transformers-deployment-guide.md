---
title: 'MiniMax Text01 / M1 Model Transformers Deployment Guide'
source: 'https://platform.minimax.io/docs/guides/text-transformers-deployment'
fetched_at: '2025-10-22T00:00:00Z'
---

# MiniMax Text01 / M1 Model Transformers Deployment Guide

## Overview

This guide covers deployment of MiniMax-M1 models using the Transformers library. As noted in the source material, "Transformers is a widely adopted machine learning framework that offers a rich collection of pretrained models and flexible APIs."

## Compatible Models

The deployment process applies to these HuggingFace repositories:

- MiniMaxAI/MiniMax-M1-40k-hf
- MiniMaxAI/MiniMax-M1-80k-hf
- MiniMaxAI/MiniMax-Text-01-hf

The key distinction: models with the "-hf" suffix differ only in their `config.json` file, while weight files remain identical to non-suffixed versions.

## Requirements & Installation

**Python Version:** 3.9 or higher

Using a virtual environment (venv, conda, or uv) prevents dependency conflicts. Install core packages via:

```bash
pip install transformers torch accelerate --extra-index-url https://download.pytorch.org/whl/cu128
```

Or with uv:

```bash
uv pip install transformers torch accelerate --torch-backend=auto
```

## Basic Implementation

Load and execute the model with this Python code:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, GenerationConfig
import torch

MODEL_PATH = "MiniMaxAI/MiniMax-M1-40k-hf"
model = AutoModelForCausalLM.from_pretrained(
    MODEL_PATH,
    device_map="auto",
    trust_remote_code=True,
)
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)

messages = [
    {"role": "user", "content": [{"type": "text", "text": "What is your favourite condiment?"}]},
    {"role": "assistant", "content": [{"type": "text", "text": "Well, I'm quite partial to a good squeeze of fresh lemon juice. It adds just the right amount of zesty flavour to whatever I'm cooking up in the kitchen!"}]},
    {"role": "user", "content": [{"type": "text", "text": "Do you have mayonnaise recipes?"}]}
]

model_inputs = tokenizer.apply_chat_template(messages, return_tensors="pt").to("cuda")
generated_ids = model.generate(model_inputs, max_new_tokens=100, do_sample=True)

response = tokenizer.batch_decode(generated_ids)[0]
print(response)
```

## Flash Attention Optimization

Enable faster inference on compatible GPUs by installing Flash Attention:

```bash
pip install flash_attn --no-build-isolation
```

Add these parameters to your model loading:

```python
model = AutoModelForCausalLM.from_pretrained(
    MODEL_PATH,
    device_map="auto",
    trust_remote_code=True,
    torch_dtype=torch.float16,
    attn_implementation="flash_attention_2"
)
```

Note: older GPUs may lack Flash Attention compatibility.

## Support Resources

For deployment assistance, contact api@minimaxi.com or visit the GitHub repository's Issues section at github.com/MiniMax-AI/MiniMax-M1/issues.
