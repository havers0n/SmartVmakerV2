/**
 * MiniMax Text Generation with Function Calling
 *
 * Provides text generation capabilities using MiniMax-M2 model
 * with support for Function Calling (OpenAI-compatible).
 */

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for text generation client
 */
export interface TextClientConfig {
  apiKey: string;
  baseUrl?: string; // Default: 'https://api.minimax.io/v1'
  model?: string; // Default: 'MiniMax-M2'
  /** SDK-level retries are disabled by default so one queue event makes one provider call. */
  maxRetries?: number;
  timeoutMs?: number;
}

/**
 * Options for generateScenariosWithTools function
 */
export interface GenerateWithToolsOptions {
  /** Provider model identifier captured in the immutable Run snapshot. */
  model?: string;
  /** System message to set context */
  systemMessage?: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature for randomness (0-1) */
  temperature?: number;
  /** Whether to enable streaming */
  stream?: boolean;
  /** Tool choice: 'auto' | 'none' | specific tool */
  toolChoice?:
    | "auto"
    | "none"
    | { type: "function"; function: { name: string } };
}

/**
 * Response from text generation with tools
 */
export interface TextGenerationResponse {
  /** Provider response identifier, safe to persist for correlation. */
  providerRequestId: string | null;
  /** Generated text content (if no tool calls) */
  content: string | null;
  /** Tool calls requested by the model */
  toolCalls: ToolCall[] | null;
  /** Full message object from OpenAI */
  message: OpenAI.Chat.Completions.ChatCompletionMessage;
  /** Usage statistics */
  usage?: OpenAI.Completions.CompletionUsage;
  /** Why the provider stopped generating the selected choice. */
  finishReason: string | null;
}

/**
 * Parsed tool call from model response
 */
export interface ToolCall {
  /** Unique ID for this tool call */
  id: string;
  /** Type of tool (always 'function' for now) */
  type: "function";
  /** Function call details */
  function: {
    /** Name of the function to call */
    name: string;
    /** Arguments as JSON string */
    arguments: string;
    /** Parsed arguments object */
    argumentsParsed?: Record<string, unknown>;
  };
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_BASE_URL = "https://api.minimax.io/v1";
const DEFAULT_MODEL = "MiniMax-M2";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_SYSTEM_MESSAGE =
  "You are a helpful AI assistant developed by MiniMax.";

// ============================================================================
// Text Generation Client
// ============================================================================

/**
 * Create a text generation client using OpenAI SDK
 */
export function createTextClient(config: TextClientConfig): OpenAI {
  if (!config.apiKey) {
    throw new Error("MiniMax API key is required");
  }

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl || DEFAULT_BASE_URL,
    maxRetries: config.maxRetries ?? 0,
    timeout: config.timeoutMs ?? 120_000,
  });
}

// ============================================================================
// Main Function: Generate with Tools
// ============================================================================

/**
 * Generate text with Function Calling support
 *
 * @param client - OpenAI client instance (created with createTextClient)
 * @param prompt - User prompt/question
 * @param tools - Array of tool definitions (functions the model can call)
 * @param options - Additional generation options
 * @returns Response containing generated text or tool calls
 *
 * @example
 * ```typescript
 * const client = createTextClient({ apiKey: process.env.MINIMAX_API_KEY! });
 *
 * const tools = [{
 *   type: 'function',
 *   function: {
 *     name: 'generate_scenarios',
 *     description: 'Generate video scenarios based on a prompt',
 *     parameters: {
 *       type: 'object',
 *       properties: {
 *         scenarios: {
 *           type: 'array',
 *           items: { type: 'object' }
 *         }
 *       },
 *       required: ['scenarios']
 *     }
 *   }
 * }];
 *
 * const response = await generateScenariosWithTools(
 *   client,
 *   'Create 3 video scenarios about technology',
 *   tools
 * );
 *
 * if (response.toolCalls) {
 *   console.log('Model wants to call:', response.toolCalls[0].function.name);
 *   console.log('With arguments:', response.toolCalls[0].function.argumentsParsed);
 * } else {
 *   console.log('Generated text:', response.content);
 * }
 * ```
 */
export async function generateScenariosWithTools(
  client: OpenAI,
  prompt: string,
  tools: ChatCompletionTool[],
  options: GenerateWithToolsOptions = {},
): Promise<TextGenerationResponse> {
  const {
    model = DEFAULT_MODEL,
    systemMessage = DEFAULT_SYSTEM_MESSAGE,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = 0.7,
    stream = false,
    toolChoice = "auto",
  } = options;

  // Build messages array
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: systemMessage,
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  try {
    // Call OpenAI Chat Completions API
    const completion = (await client.chat.completions.create({
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? toolChoice : undefined,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    })) as OpenAI.Chat.Completions.ChatCompletion;

    const message = completion.choices[0].message;
    const finishReason = completion.choices[0].finish_reason ?? null;
    const usage = completion.usage;

    // Parse tool calls if present
    const toolCalls: ToolCall[] | null = message.tool_calls
      ? message.tool_calls
          .filter(
            (
              tc,
            ): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
              type: "function";
            } => tc.type === "function",
          )
          .map((tc) => {
            const functionCall =
              tc as OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
                function: { name: string; arguments: string };
              };
            let argumentsParsed: Record<string, unknown> | undefined;
            try {
              argumentsParsed = JSON.parse(functionCall.function.arguments);
            } catch {
              console.warn("Failed to parse tool call arguments", {
                toolName: functionCall.function.name,
                rawResponseLength: functionCall.function.arguments.length,
              });
            }

            return {
              id: tc.id,
              type: "function" as const,
              function: {
                name: functionCall.function.name,
                arguments: functionCall.function.arguments,
                argumentsParsed,
              },
            };
          })
      : null;

    return {
      providerRequestId: completion.id ?? null,
      content: message.content || null,
      toolCalls,
      message,
      usage,
      finishReason,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`MiniMax text generation failed: ${error.message}`);
    }
    throw new Error("MiniMax text generation failed with unknown error");
  }
}

// ============================================================================
// Streaming Support
// ============================================================================

/**
 * Generate text with streaming support
 *
 * @param client - OpenAI client instance
 * @param prompt - User prompt
 * @param tools - Tool definitions
 * @param options - Generation options
 * @param onChunk - Callback for each chunk
 * @returns Final aggregated response
 *
 * @example
 * ```typescript
 * const response = await generateScenariosWithToolsStreaming(
 *   client,
 *   'Tell me a story',
 *   [],
 *   {},
 *   (chunk) => {
 *     process.stdout.write(chunk);
 *   }
 * );
 * ```
 */
export async function generateScenariosWithToolsStreaming(
  client: OpenAI,
  prompt: string,
  tools: ChatCompletionTool[],
  options: GenerateWithToolsOptions = {},
  onChunk?: (chunk: string) => void,
): Promise<TextGenerationResponse> {
  const {
    model = DEFAULT_MODEL,
    systemMessage = DEFAULT_SYSTEM_MESSAGE,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = 0.7,
    toolChoice = "auto",
  } = options;

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: systemMessage,
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? toolChoice : undefined,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    });

    let fullContent = "";
    let toolCallsAccumulated: any[] = [];
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }

      if (delta?.content) {
        fullContent += delta.content;
        if (onChunk) {
          onChunk(delta.content);
        }
      }

      // Accumulate tool calls (streaming can send them piece by piece)
      if (delta?.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          if (!toolCallsAccumulated[tcDelta.index]) {
            toolCallsAccumulated[tcDelta.index] = {
              id: tcDelta.id || "",
              type: "function" as const,
              function: {
                name: tcDelta.function?.name || "",
                arguments: tcDelta.function?.arguments || "",
              },
            };
          } else {
            if (tcDelta.function?.arguments) {
              toolCallsAccumulated[tcDelta.index].function.arguments +=
                tcDelta.function.arguments;
            }
          }
        }
      }
    }

    // Parse tool calls
    const toolCalls: ToolCall[] | null = toolCallsAccumulated.length
      ? toolCallsAccumulated.map((tc) => {
          let argumentsParsed: Record<string, unknown> | undefined;
          try {
            argumentsParsed = JSON.parse(tc.function.arguments);
          } catch {
            console.warn("Failed to parse tool call arguments", {
              toolName: tc.function.name,
              rawResponseLength: tc.function.arguments.length,
            });
          }

          return {
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
              argumentsParsed,
            },
          };
        })
      : null;

    // Construct final message object
    const finalMessage: OpenAI.Chat.Completions.ChatCompletionMessage = {
      role: "assistant",
      content: fullContent || null,
      refusal: null,
      tool_calls: toolCallsAccumulated.length
        ? (toolCallsAccumulated as any)
        : undefined,
    };

    return {
      providerRequestId: null,
      content: fullContent || null,
      toolCalls,
      message: finalMessage,
      usage: undefined, // Streaming doesn't provide usage stats
      finishReason,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`MiniMax streaming generation failed: ${error.message}`);
    }
    throw new Error("MiniMax streaming generation failed with unknown error");
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a simple text generation without tools
 *
 * @param client - OpenAI client instance
 * @param prompt - User prompt
 * @param options - Generation options (subset)
 * @returns Generated text
 *
 * @example
 * ```typescript
 * const client = createTextClient({ apiKey: process.env.MINIMAX_API_KEY! });
 * const text = await generateSimpleText(client, 'Hello, how are you?');
 * console.log(text);
 * ```
 */
export async function generateSimpleText(
  client: OpenAI,
  prompt: string,
  options: Pick<
    GenerateWithToolsOptions,
    "systemMessage" | "maxTokens" | "temperature"
  > = {},
): Promise<string> {
  const response = await generateScenariosWithTools(
    client,
    prompt,
    [],
    options,
  );
  return response.content || "";
}
