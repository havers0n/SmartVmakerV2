# Text Generation

> The text generation API uses **MiniMax M2** to generate conversational content and trigger tool calls based on the provided context.

It can be accessed via **HTTP requests**, the **Anthropic SDK** (Recommended), or the **OpenAI SDK**.

## Supported Models

| Model Name             | Context Window <br />(total input + output per request)        |
| :--------------------- | :------------------------------------------------------------- |
| MiniMax-M2             | 204,800                                                        |

Please note: The maximum token count refers to the total number of input and output tokens.

## Recommended Reading



  <Card title="MiniMax-M2 Function Calling Guide" icon="book-open" href="/guides/text-m2-function-call" arrow="true" cta="Click here">
    AI models can call external functions to extend their capabilities.
  </Card>
</Columns>

# M2 Function Calling Guide

> Function calling enables AI models to invoke external functions and APIs, allowing them to perform specific operations and extend their capabilities beyond text generation.

## Parameters

For complete parameter documentation, see the [Text Generation API](/api-reference/text-post) reference.

### Request Parameters

* `tools`: Defines the list of callable functions, including function names, descriptions, and parameter schemas

### Response Parameters

Key fields in function calling responses:

* `tool_calls`: Contains information about functions the model has decided to invoke
* `function.name`: The name of the function being called
* `function.arguments`: Function call parameters (JSON string format)
* `id`: Unique identifier for the tool call

## Important Note

In multi-turn function call conversations, the complete model response (i.e., the assistant message) must be append to the conversation history to maintain the continuity of the reasoning chain.

**OpenAI SDK:**

* Append the full `response_message` object to the message history (includes both `content` and `tool_calls` fields)
* When using MiniMax-M2, the `content` field contains `<think>` tags which will be automatically preserved

**Anthropic SDK:**

* Append the full `response.content` list to the message history (includes all content blocks: thinking/text/tool\_use)

See examples below for implementation details.

## Examples

### OpenAI SDK

```python  theme={null}
from openai import OpenAI
import json

# Initialize client
client = OpenAI(
    api_key="<api-key>",
    base_url="https://api.minimax.io/v1",
)

# Define tool: weather query
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location, the user should supply a location first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, US",
                    }
                },
                "required": ["location"]
            },
        }
    },
]

def send_messages(messages):
    """Send messages and return response"""
    response = client.chat.completions.create(
        model="MiniMax-M2",
        messages=messages,
        tools=tools
    )
    return response.choices[0].message

# 1. User query
messages = [{"role": "user", "content": "How's the weather in San Francisco?"}]
print(f"👤 User>\t {messages[0]['content']}")

# 2. Model returns tool call
response_message = send_messages(messages)

if response_message.tool_calls:
    tool_call = response_message.tool_calls[0]
    function_args = json.loads(tool_call.function.arguments)
    print(f"💬 Model>\t {response_message.content}")
    print(f"🔧 Tool>\t {tool_call.function.name}({function_args['location']})")

    # 3. Execute tool and return result
    messages.append(response_message)
    messages.append({
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": "24℃, sunny"  # In production, call actual weather API here
    })

    # 4. Get final response
    final_message = send_messages(messages)
    print(f"💬 Model>\t {final_message.content}")
else:
    print(f"💬 Model>\t {response_message.content}")
```

**Output:**

```nushell  theme={null}
👤 User>         How's the weather in San Francisco?
💬 Model>        <think>
Alright, the user is asking about the weather in San Francisco. This is a straightforward request that requires me to provide weather information.

Looking at the tools available to me, I see I have access to a "get_weather" tool that can retrieve weather information for a specific location. This is exactly what I need for this query.

The tool requires a "location" parameter, which should be the city and state (or in this case, city and country). The user has asked about "San Francisco" which is a major city in US. To use the tool properly, I should format the location as "San Francisco, US" to be specific and ensure I get the correct weather data.

I could try to guess or provide general information about San Francisco's climate, but that would be unreliable and potentially inaccurate. The best approach is to use the provided tool to get the current, accurate weather information.

So I'll need to make a tool call to "get_weather" with the argument "location" set to "San Francisco, US". This will retrieve the current weather conditions for San Francisco, which is exactly what the user is asking for.

Once I get the weather data back from the tool, I'll be able to provide the user with accurate information about the current weather conditions in San Francisco. But first, I need to make the tool call.
</think>

🔧 Tool>         get_weather(San Francisco, US)
💬 Model>        <think>
I've just called the get_weather tool to check the current weather conditions in San Francisco, and I've received the response. Let me analyze what I got back.

The tool returned "24℃, sunny" which is a simple but clear weather description. It tells me two important pieces of information:
1. The temperature is 24 degrees Celsius (which is a comfortable temperature, about 75°F)
2. The weather condition is sunny, which means clear skies and good visibility

This is exactly the information the user was asking for when they inquired "How's the weather in San Francisco?" They wanted to know the current conditions, and now I have that data.

I should format this information in a clear, concise way for the user. Since the data is straightforward, I don't need to elaborate with additional details about humidity, wind, or other metrics. A simple, direct response that answers their question is best.

I'll mention both the temperature and the sunny conditions to give them a complete picture of the weather. I don't need to add any caveats or additional information since the data is clear and specific.

My response should be brief but informative, giving them exactly what they asked for in a friendly manner. I'll just state the temperature and weather condition clearly.
</think>
The weather in San Francisco is currently 24℃ and sunny.
```

### Anthropic SDK

```python  theme={null}
import anthropic
import json

# Initialize client
client = anthropic.Anthropic(
    base_url="https://api.minimax.io/anthropic",
    api_key="<your api key>"  # Replace with your MiniMax API Key
)

# Define tool: weather query
tools = [
    {
        "name": "get_weather",
        "description": "Get weather of a location, the user should supply a location first.",
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, US",
                }
            },
            "required": ["location"]
        }
    }
]

def send_messages(messages):
    params = {
        "model": "MiniMax-M2",
        "max_tokens": 4096,
        "messages": messages,
        "tools": tools,
    }

    response = client.messages.create(**params)
    return response

def process_response(response):
    thinking_blocks = []
    text_blocks = []
    tool_use_blocks = []

    # Iterate through all content blocks
    for block in response.content:
        if block.type == "thinking":
            thinking_blocks.append(block)
            print(f"💭 Thinking>\n{block.thinking}\n")
        elif block.type == "text":
            text_blocks.append(block)
            print(f"💬 Model>\t{block.text}")
        elif block.type == "tool_use":
            tool_use_blocks.append(block)
            print(f"🔧 Tool>\t{block.name}({json.dumps(block.input, ensure_ascii=False)})")

    return thinking_blocks, text_blocks, tool_use_blocks

# 1. User query
messages = [{"role": "user", "content": "How's the weather in San Francisco?"}]
print(f"\n👤 User>\t {messages[0]['content']}")

# 2. Model returns first response (may include tool calls)
response = send_messages(messages)
thinking_blocks, text_blocks, tool_use_blocks = process_response(response)

# 3. If tool calls exist, execute tools and continue conversation
if tool_use_blocks:
    # ⚠️ Critical: Append the assistant's complete response to message history
    # response.content contains a list of all blocks: [thinking block, text block, tool_use block]
    # Must be fully preserved, otherwise subsequent conversation will lose context
    messages.append({
        "role": "assistant",
        "content": response.content
    })

    # Execute tool and return result (simulating weather API call)
    print(f"\n🔨 Executing tool: {tool_use_blocks[0].name}")
    tool_result = "24℃, sunny"
    print(f"📊 Tool result: {tool_result}")

    # Add tool execution result
    messages.append({
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": tool_use_blocks[0].id,
                "content": tool_result
            }
        ]
    })

    # 4. Get final response
    final_response = send_messages(messages)
    process_response(final_response)
```

**Output:**

```nushell  theme={null}
👤 User>         How's the weather in San Francisco?
💭 Thinking>
Okay, so the user is asking about the weather in San Francisco. This is a straightforward request that requires me to get current weather information for a specific location.

Looking at my available tools, I see I have a `get_weather` function that can provide weather information for a location. This is exactly what I need to answer the user's question. The function requires a "location" parameter, which should be a string containing the city and potentially the state/country.

In this case, the user has clearly specified San Francisco as the location. San Francisco is a major city in US, so I don't need to include the country code - just "San Francisco" should be sufficient for the weather service to identify the correct location.

The required parameters for the get_weather tool are:
- location: "San Francisco"

I should call this tool to retrieve the current weather information for San Francisco before I can provide a meaningful answer to the user. Once I get the weather data back from the tool, I'll be able to share details like temperature, conditions (sunny, cloudy, rainy, etc.), and possibly other relevant information like humidity or wind speed.

So I'll make a tool call to get_weather with the location parameter set to "San Francisco". After I receive the response from this tool call, I'll be able to provide the user with the current weather information they requested.

🔧 Tool>        get_weather({"location": "San Francisco"})

🔨 Executing tool: get_weather
📊 Tool result: 24℃, sunny
💭 Thinking>
I've just called the get_weather tool to check the current conditions in San Francisco as the user requested. Let me analyze what information I received back.

The tool returned a simple response: "24℃, sunny". This is quite straightforward - it tells me the current temperature is 24 degrees Celsius and the weather conditions are sunny. This is exactly the basic weather information the user was asking about.

The temperature is given in Celsius (24℃), which is appropriate since US uses the metric system. I could convert this to Fahrenheit for users who might be more familiar with that scale, but since the user didn't specify a preference, I'll stick with the metric measurement as provided by the tool.

For the weather condition, I received "sunny" which indicates clear skies and good visibility. This is useful information that tells the user they can expect good weather if they're planning to be outside.

I don't have additional details like humidity, wind speed, or UV index from the tool response. If the user wants more detailed information, they could ask a follow-up question, and I might need to provide general advice about sunny weather conditions or suggest checking a more detailed weather service.

Now I need to formulate a clear, concise response to the user that directly answers their question about the weather in San Francisco. I'll keep it simple and factual, stating the temperature and conditions clearly. I should also add a friendly closing to invite further questions if needed.

The most straightforward way to present this information is to state the temperature first, followed by the conditions, and then add a friendly note inviting the user to ask for more information if they want it.

💬 Model>       The current weather in San Francisco is 24℃ and sunny.
```

# M2 Function Calling Guide

> Function calling enables AI models to invoke external functions and APIs, allowing them to perform specific operations and extend their capabilities beyond text generation.

## Parameters

For complete parameter documentation, see the [Text Generation API](/api-reference/text-post) reference.

### Request Parameters

* `tools`: Defines the list of callable functions, including function names, descriptions, and parameter schemas

### Response Parameters

Key fields in function calling responses:

* `tool_calls`: Contains information about functions the model has decided to invoke
* `function.name`: The name of the function being called
* `function.arguments`: Function call parameters (JSON string format)
* `id`: Unique identifier for the tool call

## Important Note

In multi-turn function call conversations, the complete model response (i.e., the assistant message) must be append to the conversation history to maintain the continuity of the reasoning chain.

**OpenAI SDK:**

* Append the full `response_message` object to the message history (includes both `content` and `tool_calls` fields)
* When using MiniMax-M2, the `content` field contains `<think>` tags which will be automatically preserved

**Anthropic SDK:**

* Append the full `response.content` list to the message history (includes all content blocks: thinking/text/tool\_use)

See examples below for implementation details.

## Examples

### OpenAI SDK

```python  theme={null}
from openai import OpenAI
import json

# Initialize client
client = OpenAI(
    api_key="<api-key>",
    base_url="https://api.minimax.io/v1",
)

# Define tool: weather query
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather of a location, the user should supply a location first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, US",
                    }
                },
                "required": ["location"]
            },
        }
    },
]

def send_messages(messages):
    """Send messages and return response"""
    response = client.chat.completions.create(
        model="MiniMax-M2",
        messages=messages,
        tools=tools
    )
    return response.choices[0].message

# 1. User query
messages = [{"role": "user", "content": "How's the weather in San Francisco?"}]
print(f"👤 User>\t {messages[0]['content']}")

# 2. Model returns tool call
response_message = send_messages(messages)

if response_message.tool_calls:
    tool_call = response_message.tool_calls[0]
    function_args = json.loads(tool_call.function.arguments)
    print(f"💬 Model>\t {response_message.content}")
    print(f"🔧 Tool>\t {tool_call.function.name}({function_args['location']})")

    # 3. Execute tool and return result
    messages.append(response_message)
    messages.append({
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": "24℃, sunny"  # In production, call actual weather API here
    })

    # 4. Get final response
    final_message = send_messages(messages)
    print(f"💬 Model>\t {final_message.content}")
else:
    print(f"💬 Model>\t {response_message.content}")
```

**Output:**

```nushell  theme={null}
👤 User>         How's the weather in San Francisco?
💬 Model>        <think>
Alright, the user is asking about the weather in San Francisco. This is a straightforward request that requires me to provide weather information.

Looking at the tools available to me, I see I have access to a "get_weather" tool that can retrieve weather information for a specific location. This is exactly what I need for this query.

The tool requires a "location" parameter, which should be the city and state (or in this case, city and country). The user has asked about "San Francisco" which is a major city in US. To use the tool properly, I should format the location as "San Francisco, US" to be specific and ensure I get the correct weather data.

I could try to guess or provide general information about San Francisco's climate, but that would be unreliable and potentially inaccurate. The best approach is to use the provided tool to get the current, accurate weather information.

So I'll need to make a tool call to "get_weather" with the argument "location" set to "San Francisco, US". This will retrieve the current weather conditions for San Francisco, which is exactly what the user is asking for.

Once I get the weather data back from the tool, I'll be able to provide the user with accurate information about the current weather conditions in San Francisco. But first, I need to make the tool call.
</think>

🔧 Tool>         get_weather(San Francisco, US)
💬 Model>        <think>
I've just called the get_weather tool to check the current weather conditions in San Francisco, and I've received the response. Let me analyze what I got back.

The tool returned "24℃, sunny" which is a simple but clear weather description. It tells me two important pieces of information:
1. The temperature is 24 degrees Celsius (which is a comfortable temperature, about 75°F)
2. The weather condition is sunny, which means clear skies and good visibility

This is exactly the information the user was asking for when they inquired "How's the weather in San Francisco?" They wanted to know the current conditions, and now I have that data.

I should format this information in a clear, concise way for the user. Since the data is straightforward, I don't need to elaborate with additional details about humidity, wind, or other metrics. A simple, direct response that answers their question is best.

I'll mention both the temperature and the sunny conditions to give them a complete picture of the weather. I don't need to add any caveats or additional information since the data is clear and specific.

My response should be brief but informative, giving them exactly what they asked for in a friendly manner. I'll just state the temperature and weather condition clearly.
</think>
The weather in San Francisco is currently 24℃ and sunny.
```

### Anthropic SDK

```python  theme={null}
import anthropic
import json

# Initialize client
client = anthropic.Anthropic(
    base_url="https://api.minimax.io/anthropic",
    api_key="<your api key>"  # Replace with your MiniMax API Key
)

# Define tool: weather query
tools = [
    {
        "name": "get_weather",
        "description": "Get weather of a location, the user should supply a location first.",
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, US",
                }
            },
            "required": ["location"]
        }
    }
]

def send_messages(messages):
    params = {
        "model": "MiniMax-M2",
        "max_tokens": 4096,
        "messages": messages,
        "tools": tools,
    }

    response = client.messages.create(**params)
    return response

def process_response(response):
    thinking_blocks = []
    text_blocks = []
    tool_use_blocks = []

    # Iterate through all content blocks
    for block in response.content:
        if block.type == "thinking":
            thinking_blocks.append(block)
            print(f"💭 Thinking>\n{block.thinking}\n")
        elif block.type == "text":
            text_blocks.append(block)
            print(f"💬 Model>\t{block.text}")
        elif block.type == "tool_use":
            tool_use_blocks.append(block)
            print(f"🔧 Tool>\t{block.name}({json.dumps(block.input, ensure_ascii=False)})")

    return thinking_blocks, text_blocks, tool_use_blocks

# 1. User query
messages = [{"role": "user", "content": "How's the weather in San Francisco?"}]
print(f"\n👤 User>\t {messages[0]['content']}")

# 2. Model returns first response (may include tool calls)
response = send_messages(messages)
thinking_blocks, text_blocks, tool_use_blocks = process_response(response)

# 3. If tool calls exist, execute tools and continue conversation
if tool_use_blocks:
    # ⚠️ Critical: Append the assistant's complete response to message history
    # response.content contains a list of all blocks: [thinking block, text block, tool_use block]
    # Must be fully preserved, otherwise subsequent conversation will lose context
    messages.append({
        "role": "assistant",
        "content": response.content
    })

    # Execute tool and return result (simulating weather API call)
    print(f"\n🔨 Executing tool: {tool_use_blocks[0].name}")
    tool_result = "24℃, sunny"
    print(f"📊 Tool result: {tool_result}")

    # Add tool execution result
    messages.append({
        "role": "user",
        "content": [
            {
                "type": "tool_result",
                "tool_use_id": tool_use_blocks[0].id,
                "content": tool_result
            }
        ]
    })

    # 4. Get final response
    final_response = send_messages(messages)
    process_response(final_response)
```

**Output:**

```nushell  theme={null}
👤 User>         How's the weather in San Francisco?
💭 Thinking>
Okay, so the user is asking about the weather in San Francisco. This is a straightforward request that requires me to get current weather information for a specific location.

Looking at my available tools, I see I have a `get_weather` function that can provide weather information for a location. This is exactly what I need to answer the user's question. The function requires a "location" parameter, which should be a string containing the city and potentially the state/country.

In this case, the user has clearly specified San Francisco as the location. San Francisco is a major city in US, so I don't need to include the country code - just "San Francisco" should be sufficient for the weather service to identify the correct location.

The required parameters for the get_weather tool are:
- location: "San Francisco"

I should call this tool to retrieve the current weather information for San Francisco before I can provide a meaningful answer to the user. Once I get the weather data back from the tool, I'll be able to share details like temperature, conditions (sunny, cloudy, rainy, etc.), and possibly other relevant information like humidity or wind speed.

So I'll make a tool call to get_weather with the location parameter set to "San Francisco". After I receive the response from this tool call, I'll be able to provide the user with the current weather information they requested.

🔧 Tool>        get_weather({"location": "San Francisco"})

🔨 Executing tool: get_weather
📊 Tool result: 24℃, sunny
💭 Thinking>
I've just called the get_weather tool to check the current conditions in San Francisco as the user requested. Let me analyze what information I received back.

The tool returned a simple response: "24℃, sunny". This is quite straightforward - it tells me the current temperature is 24 degrees Celsius and the weather conditions are sunny. This is exactly the basic weather information the user was asking about.

The temperature is given in Celsius (24℃), which is appropriate since US uses the metric system. I could convert this to Fahrenheit for users who might be more familiar with that scale, but since the user didn't specify a preference, I'll stick with the metric measurement as provided by the tool.

For the weather condition, I received "sunny" which indicates clear skies and good visibility. This is useful information that tells the user they can expect good weather if they're planning to be outside.

I don't have additional details like humidity, wind speed, or UV index from the tool response. If the user wants more detailed information, they could ask a follow-up question, and I might need to provide general advice about sunny weather conditions or suggest checking a more detailed weather service.

Now I need to formulate a clear, concise response to the user that directly answers their question about the weather in San Francisco. I'll keep it simple and factual, stating the temperature and conditions clearly. I should also add a friendly closing to invite further questions if needed.

The most straightforward way to present this information is to state the temperature first, followed by the conditions, and then add a friendly note inviting the user to ask for more information if they want it.

💬 Model>       The current weather in San Francisco is 24℃ and sunny.
```

## Recommended Reading

<Columns cols={2}>
  <Card title="M2 for AI Coding Tools" icon="book-open" href="/guides/text-ai-coding-tools" arrow="true" cta="Click here">
    MiniMax-M2 excels at code understanding, dialogue, and reasoning.
  </Card>

  <Card title="Building Agents with MiniMax M2: Best Practices" icon="book-open" arrow="true" href="https://github.com/MiniMax-AI/Mini-Agent/blob/main/README.md" cta="Click here">
    This guide provides comprehensive best practices for building
    production-grade Agent systems, based on real-world experience with the
    mini-agent project
  </Card>

  <Card title="Compatible Anthropic API (Recommended)" icon="book-open" href="/api-reference/text-anthropic-api" arrow="true" cta="Click here">
    Use Anthropic SDK with MiniMax models
  </Card>

  <Card title="Compatible OpenAI API" icon="book-open" href="/api-reference/text-openai-api" arrow="true" cta="Click here">
    Use OpenAI SDK with MiniMax models
  </Card>
</Columns>

# Image Generation Guide

> The Image Generation service provides two core capabilities: **Text-to-Image** and **Image-to-Image**.

## Generate Images from Text

Create images directly from detailed text descriptions (prompts) that specify the desired content.

```python  theme={null}
import base64
import requests
import os

url = "https://api.minimax.io/v1/image_generation"
api_key = os.environ["MINIMAX_API_KEY"]
headers = {"Authorization": f"Bearer {api_key}"}

payload = {
    "model": "image-01",
    "prompt": "men Dressing in white t shirt, full-body stand front view image :25, outdoor, Venice beach sign, full-body image, Los Angeles, Fashion photography of 90s, documentary, Film grain, photorealistic",
    "aspect_ratio": "16:9",
    "response_format": "base64",
}

response = requests.post(url, headers=headers, json=payload)
response.raise_for_status()

images = response.json()["data"]["image_base64"]

for i in range(len(images)):
    with open(f"output-{i}.jpeg", "wb") as f:
        f.write(base64.b64decode(images[i]))
```

The generated picture：

<img src="https://filecdn.minimax.chat/public/b2c8d2e7-e0bf-4f00-8e91-6b7b18c17bda.jpeg" alt="图片描述" />

## Generate Images with Reference Images

This feature allows you to supply one or more reference images (including online image URLs) that contain a clear subject. Combined with a text prompt, the service generates a new image that preserves the subject’s key characteristics.\
This is particularly useful for scenarios that require consistent visual identity, such as generating images of the same virtual character in different contexts.

```python  theme={null}
import base64
import requests
import os

url = "https://api.minimax.io/v1/image_generation"
api_key = os.environ["MINIMAX_API_KEY"]
headers = {"Authorization": f"Bearer {api_key}"}

payload = {
    "model": "image-01",
    "prompt": "A girl stands by the library window, gazing into the distance",
    "aspect_ratio": "16:9",
    "subject_reference": [
        {
            "type": "character",
            "image_file": "https://cdn.hailuoai.com/prod/2025-08-12-17/video_cover/1754990600020238321-411603868533342214-cover.jpg",
        }
    ],
    "response_format": "base64",
}

response = requests.post(url, headers=headers, json=payload)
response.raise_for_status()
images = response.json()["data"]["image_base64"]

for i in range(len(images)):
    with open(f"output-{i}.jpeg", "wb") as f:
        f.write(base64.b64decode(images[i]))
```

The generated picture：

<img src="https://filecdn.minimax.chat/public/5fc99b37-d323-4d8c-9bd5-ecedf88a985a.jpeg" alt="图片描述" />





 