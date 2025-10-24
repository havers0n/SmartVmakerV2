---
title: 'MiniMax M1 Function Call Guide'
source: 'https://platform.minimax.io/docs/guides/text-function-call'
fetched_at: '2025-10-22T00:00:00Z'
---

# MiniMax M1 Function Call Guide

This document will help you quickly get started with the function calling feature of [MiniMax-M1](https://huggingface.co/MiniMaxAI/MiniMax-M1-80k).

Function Calling is an advanced capability enabled through prompt engineering. Developers can predefine a set of functions, and the model will automatically determine when to invoke them based on user input. The function call parameters are returned in JSON format.

Common use cases include weather queries, web searches, database lookups, and similar tasks.

## Using vLLM for Function Calling (Recommended)

Make sure vLLM is successfully deployed and the service can start normally.

MiniMax-M1 integrates the custom `tool_call_parser`, so you do not need to manually parse model outputs.

When starting vLLM, simply add the following parameters to enable function calling (`--enable-auto-tool-choice`, `--tool-call-parser minimax`, `--chat-template examples/tool_chat_template_minimax_m1.jinja`):

```bash
SAFETENSORS_FAST_GPU=1 VLLM_USE_V1=0 vllm serve MiniMaxAI/MiniMax-M1-40k \
  --trust-remote-code \
  --quantization experts_int8 \
  --dtype bfloat16 \
  --enable-auto-tool-choice \
  --tool-call-parser minimax \
  --chat-template examples/tool_chat_template_minimax_m1.jinja
```

If you are using vLLM via Docker, simply add the same parameters in your Docker run command:

```bash
docker run --runtime nvidia --gpus all \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  --env "SAFETENSORS_FAST_GPU=1" \
  --env "VLLM_USE_V1=0" \
  -p 8000:8000 \
  --ipc=host \
  vllm/vllm-openai:latest \
  --model MiniMaxAI/MiniMax-M1-40k \
  --trust-remote-code \
  --quantization experts_int8 \
  --dtype bfloat16 \
  --enable-auto-tool-choice \
  --tool-call-parser minimax \
  --chat-template examples/tool_chat_template_minimax_m1.jinja
```

**Parameter explanations:**

- `--tool-call-parser minimax`: Key parameter to enable MiniMax-M1 custom parser.
- `--enable-auto-tool-choice`: Enables automatic tool selection.
- `--chat-template`: Template file must be adapted for tool calling. You can find the template here: https://github.com/vllm-project/vllm/blob/main/examples/tool_chat_template_minimax_m1.jinja

## Using the OpenAI SDK for Function Calling

The following example demonstrates how to implement a weather query with the OpenAI SDK:

```python
from openai import OpenAI
import json

client = OpenAI(base_url="http://localhost:8000/v1", api_key="dummy")

def get_weather(location: str, unit: str):
    return f"Getting the weather for {location} in {unit}..."

tool_functions = {"get_weather": get_weather}

tools = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a given location",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "City and state, e.g., 'San Francisco, CA'"},
                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]}
            },
            "required": ["location", "unit"]
        }
    }
}]

response = client.chat.completions.create(
    model=client.models.list().data[0].id,
    messages=[{"role": "user", "content": "What's the weather like in San Francisco? use celsius."}],
    tools=tools,
    tool_choice="auto"
)

print(response)
tool_call = response.choices[0].message.tool_calls[0].function
print(f"Function called: {tool_call.name}")
print(f"Arguments: {tool_call.arguments}")
print(f"Result: {get_weather(**json.loads(tool_call.arguments))}")
```

Example output:

```
Function called: get_weather
Arguments: {"location": "San Francisco, CA", "unit": "celsius"}
Result: Getting the weather for San Francisco, CA in celsius...
```

## Function Call Definition Format

### Function Definition

Function calls must be defined in the `tools` field of the request body. Each function includes the following parts:

```json
{
  "tools": [
    {
      "name": "search_web",
      "description": "Search function.",
      "parameters": {
        "properties": {
          "query_list": {
            "description": "Keywords for the search, list size should be 1.",
            "items": { "type": "string" },
            "type": "array"
          },
          "query_tag": {
            "description": "Category of the query",
            "items": { "type": "string" },
            "type": "array"
          }
        },
        "required": ["query_list", "query_tag"],
        "type": "object"
      }
    }
  ]
}
```

**Field descriptions:**

- `name`: Function name.
- `description`: Function purpose.
- `parameters`: Function parameter definitions.
  - `properties`: Parameter attributes, where key is the parameter name, and value contains details.
  - `required`: List of required parameters.
  - `type`: Parameter type (usually `"object"`).

### Model Internal Processing Format

During internal processing, function definitions are converted into a special format and appended to the input text. Developers do not need to construct this manually. Example during internal processing:

```
<begin_of_document><beginning_of_sentence>system ai_setting=MiniMax AI
MiniMax AI is an automatic AI assistant developed by Shanghai MiniMax Technology Co., Ltd.<end_of_sentence>
<beginning_of_sentence>system tool_setting=tools
You are provided with these tools:
<tools>
{"name": "search_web", "description": "Search function.", "parameters": {"properties": {"query_list": {"description": "Keywords for search, list size should be 1.", "items": {"type": "string"}, "type": "array"}, "query_tag": {"description": "Category of query", "items": {"type": "string"}, "type": "array"}}, "required": ["query_list", "query_tag"], "type": "object"}}
</tools>
If you need to call tools, please respond with <tool_calls></tool_calls> XML tags, and provide tool-name and json-object of arguments, following the format below:
<tool_calls>
{"name": <tool-name>, "arguments": <args-json-object>}
...
</tool_calls><end_of_sentence>
<beginning_of_sentence>user name=User
When were the latest OpenAI and Gemini release events?<end_of_sentence>
<beginning_of_sentence>ai name=MiniMax AI
```

## Model Output Format

Model outputs function calls in the following format:

```xml
<think>
Okay, I will search for the OpenAI and Gemini latest release.
</think>
<tool_calls>
{"name": "search_web", "arguments": {"query_tag": ["technology", "events"], "query_list": ["\"OpenAI\" \"latest\" \"release\""]}}
{"name": "search_web", "arguments": {"query_tag": ["technology", "events"], "query_list": ["\"Gemini\" \"latest\" \"release\""]}}
</tool_calls>
```

## Manual Parsing of Model Output

We recommend using the OpenAI Chat Completions API, which automatically applies the Chat Template on the server side and is supported by major inference frameworks.

If your framework does not support Tool Calling, if you are not using vLLM's built-in parser, or if you use other inference frameworks (e.g., Transformers, TGI), you can manually parse the model output as shown below.

### Applying Chat Template Manually

Example with the `transformers` library:

```python
from transformers import AutoTokenizer

def get_default_tools():
    return [
        {
            "name": "get_current_weather",
            "description": "Get the latest weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "A city, e.g., Beijing, Shanghai"
                    }
                },
                "required": ["location"],
                "type": "object"
            }
        }
    ]

# Load model and tokenizer
model_id = "MiniMaxAI/MiniMax-M1-40k"
tokenizer = AutoTokenizer.from_pretrained(model_id)

prompt = "What's the weather like in Shanghai today?"
messages = [
    {"role": "system", "content": [{"type": "text", "text": "You are a helpful assistant created by MiniMax based on MiniMax-M1 model."}]},
    {"role": "user", "content": [{"type": "text", "text": prompt}]},
]

with open("/vllm-workspace/examples/tool_chat_template_minimax_m1.jinja", "r") as f:
    tokenizer.chat_template = f.read()

# Enable function calling
tools = get_default_tools()

# Apply chat template with tools
text = tokenizer.apply_chat_template(
    messages,
    tokenize=False,
    add_generation_prompt=True,
    tools=tools
)

# Send request (any inference service can be used)
import requests
payload = {
    "model": model_id,
    "prompt": text,
    "max_tokens": 4000
}
response = requests.post(
    "http://localhost:8000/v1/completions",
    headers={"Content-Type": "application/json"},
    json=payload,
    stream=False,
)

# Manual parsing of model output
raw_json = response.json()
raw_output = raw_json["choices"][0]["text"]
print("Raw output:", raw_output)

# Parse function calls
function_calls = parse_function_calls(raw_output)
```

### Parsing Function Calls

When parsing manually, extract the `<tool_calls>` tag content:

```python
import re
import json

def parse_function_calls(content: str):
    """
    Parse function calls from the model output
    """
    function_calls = []

    # Match content inside <tool_calls> tags
    tool_calls_pattern = r"<tool_calls>(.*?)</tool_calls>"
    tool_calls_match = re.search(tool_calls_pattern, content, re.DOTALL)

    if not tool_calls_match:
        return function_calls

    tool_calls_content = tool_calls_match.group(1).strip()

    # Each function call(Each line represents one JSON object)
    for line in tool_calls_content.split('\n'):
        line = line.strip()
        if not line:
            continue
        try:
            # Parse JSON-formatted function call
            call_data = json.loads(line)
            function_name = call_data.get("name")
            arguments = call_data.get("arguments", {})

            function_calls.append({
                "name": function_name,
                "arguments": arguments
            })
            print(f"Function called: {function_name}, Arguments: {arguments}")
        except json.JSONDecodeError as e:
            print(f"Failed to parse arguments: {line}, Error: {e}")

    return function_calls

# Example: handle weather query function and web search function
def execute_function_call(function_name: str, arguments: dict):
    """
    Execute a function call and return the result
    """
    if function_name == "get_current_weather":
        location = arguments.get("location", "Unknown location")
        # Construct function execution result
        return {
            "role": "tool",
            "content": [
                {
                    "name": function_name,
                    "type": "text",
                    "text": json.dumps({
                        "location": location,
                        "temperature": "25",
                        "unit": "celsius",
                        "weather": "sunny"
                    }, ensure_ascii=False)
                }
            ]
        }
    elif function_name == "search_web":
        query_list = arguments.get("query_list", [])
        query_tag = arguments.get("query_tag", [])
        # Simulate search results
        return {
            "role": "tool",
            "content": [
                {
                    "name": function_name,
                    "type": "text",
                    "text": f"Search keywords: {query_list}, Tags: {query_tag}\nSearch results: Relevant information found"
                }
            ]
        }

    return None
```

### Returning Function Results to the Model

After successful parsing, add the execution results back into the conversation history, so the model can use them in follow-up interactions.

**Single Result**

If the model calls `search_web`, return results in this format:

```json
{
  "role": "tool",
  "content": [
    {
      "name": "search_web",
      "type": "text",
      "text": "test_result"
    }
  ]
}
```

Corresponding input to the model:

```
<beginning_of_sentence>tool name=tools
tool name: search_web
tool result: test_result
<end_of_sentence>
```

**Multiple Results**

If the model calls both `search_web` and `get_current_weather`, return:

```json
{
  "role": "tool",
  "content": [
    {
      "name": "search_web",
      "type": "text",
      "text": "test_result1"
    },
    {
      "name": "get_current_weather",
      "type": "text",
      "text": "test_result2"
    }
  ]
}
```

Corresponding model input:

```
<beginning_of_sentence>tool name=tools
tool name: search_web
tool result: test_result1
tool name: get_current_weather
tool result: test_result2<end_of_sentence>
```

While we recommend the above format, as long as the returned input is understandable, you are free to customize `name` and `text` values.

## FAQ

**Q: Tool Call response is not valid JSON**

A: Check your request. If the Tool Call guidance in the request is not valid JSON, the wrong chat template is being applied. Please use [tool_chat_template_minimax_m1.jinja](https://github.com/vllm-project/vllm/blob/main/examples/tool_chat_template_minimax_m1.jinja).

## References

- [MiniMax-M1 Model Repository](https://github.com/MiniMax-AI/MiniMax-M1)
- [vLLM Project Homepage](https://github.com/vllm-project/vllm)
- [vLLM Function Calling PR](https://github.com/vllm-project/vllm/pull/20297)
- [OpenAI Python SDK](https://github.com/openai/openai-python)

## Getting Support

If you encounter issues deploying the MiniMax model:

- Contact our support team via email at [api@minimax.io](mailto:api@minimax.io)
- Submit an [Issue](https://github.com/MiniMax-AI/MiniMax-M1/issues) on our GitHub repository

We will continue to optimize the Function Call deployment experience, and we welcome your feedback!
