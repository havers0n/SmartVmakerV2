---
title: 'Text Generation Guide'
source: 'https://platform.minimax.io/docs/guides/text-generation'
fetched_at: '2025-10-22T00:00:00Z'
---

# Text Generation Guide

You can use the OpenAI library to access the MiniMax model for text generation.

## Text Generation

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ["MINIMAX_API_KEY"],
    base_url="https://api.minimax.io/v1",
)

messages = [
    {"role": "system", "name": "MiniMax AI"},
    {"role": "user", "name": "User", "content": "Hello"},
]

completion = client.chat.completions.create(
    model="MiniMax-M1",
    messages=messages,
    max_tokens=4096,
)

print(completion.choices[0].message)
```

## Streaming Generation

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ["MINIMAX_API_KEY"],
    base_url="https://api.minimax.io/v1",
)

messages = [
    {"role": "system", "name": "MiniMax AI"},
    {"role": "user", "name": "User", "content": "Hello"},
]

completion = client.chat.completions.create(
    model="MiniMax-M1",
    messages=messages,
    max_tokens=4096,
    stream=True
)

for chunk in completion:
    print(chunk.choices[0].delta)
```

## Function Calling

For usage details of Function Calling, see [Developer Guide / Function Calling](/docs/guides/text-function-call)

## Image Understanding

```python
import base64
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ["MINIMAX_API_KEY"],
    base_url="https://api.minimax.io/v1",
)

messages = [
    {
        "role": "system",
        "name": "MiniMax AI",
        "content": "MM Smart Assistant is a large language model independently developed by MiniMax, without using third-party APIs. MiniMax is a technology company based in China, dedicated to research and development of large-scale models.",
    },
    {
        "role": "user",
        "name": "User",
        "content": [
            {"type": "text", "text": "What does this picture represent?"},
            {
                "type": "image_url",
                "image_url": {
                    "url": "https://cdn.hailuoai.com/prod/2024-09-18-16/user/multi_chat_file/9c0b5c14-ee88-4a5b-b503-4f626f018639.jpeg"
                },
            },
        ],
    },
]

completion = client.chat.completions.create(
    model="MiniMax-Text-01",
    messages=messages,
    max_tokens=4096,
)

print(completion.choices[0].message)
```

## Related Guides

- [M1 for AI Coding Tools](./text-ai-coding-tools.md)
- [MiniMax M1 Function Call Guide](./text-function-call-guide.md)
