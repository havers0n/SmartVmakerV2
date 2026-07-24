import { createHaluClient } from "@scrimspec/halu-client";
import type {
  ImageProviderInput,
  ImageProviderResult,
  ProviderAdapter,
} from "@scrimspec/hwar-core";

const PROVIDER_TIMEOUT_MS = 120_000;

export function createMiniMaxProviderAdapter(): ProviderAdapter {
  return { generate };
}

async function generate(
  input: ImageProviderInput,
): Promise<ImageProviderResult> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PROVIDER_NOT_CONFIGURED: MiniMax API key (MINIMAX_API_KEY) is not set",
    );
  }

  const modelId = input.modelId;
  if (!modelId || modelId === "unknown") {
    throw new Error(
      "PROVIDER_NOT_CONFIGURED: Frozen MiniMax modelId is invalid",
    );
  }

  const baseUrl = process.env.MINIMAX_API_BASE_URL
    ? process.env.MINIMAX_API_BASE_URL.replace(/\/$/, "").replace(
        /\/v\d+$/,
        "",
      ) + "/v1"
    : undefined;

  const aspectRatio =
    typeof input.settings.aspectRatio === "string"
      ? input.settings.aspectRatio
      : "16:9";

  const client = createHaluClient({ apiKey, baseUrl });

  let response;
  try {
    response = await client.generateImage(
      {
        model: modelId as any,
        prompt: input.prompt,
        aspect_ratio: aspectRatio as any,
        response_format: "base64",
      },
      { signal: input.signal, timeoutMs: PROVIDER_TIMEOUT_MS },
    );
  } catch (error: any) {
    if (
      error?.name === "AbortError" ||
      error?.message?.includes("timed out") ||
      error?.message?.includes("timeout")
    ) {
      throw new Error("PROVIDER_TIMEOUT: MiniMax request timed out");
    }
    if (error?.name === "HaluApiError") {
      const code = error.statusCode;
      const msg = error.statusMsg ?? "MiniMax API error";
      if (code === 1002 || code === 1004 || code === 2049 || code === 1008) {
        throw new Error(`PROVIDER_REJECTED: ${msg}`);
      }
      throw new Error(`PROVIDER_REJECTED: MiniMax error ${code} - ${msg}`);
    }
    throw error;
  }

  const dataArray = response.data;
  let base64: string | undefined;
  if (Array.isArray(dataArray)) {
    base64 = dataArray[0]?.image_base64;
  } else if (
    dataArray &&
    typeof dataArray === "object" &&
    "image_base64" in dataArray
  ) {
    base64 = (dataArray as Record<string, unknown>).image_base64 as string;
  }

  if (!base64 || typeof base64 !== "string" || base64.length === 0) {
    throw new Error(
      "PROVIDER_INVALID_RESPONSE: MiniMax response missing image_base64",
    );
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error(
      "PROVIDER_INVALID_RESPONSE: MiniMax returned empty image data",
    );
  }

  if (buffer.length > 20 * 1024 * 1024) {
    throw new Error(
      "PROVIDER_INVALID_RESPONSE: MiniMax response exceeds 20MB limit",
    );
  }

  return {
    buffer,
    providerRequestId: undefined,
    finishReason: undefined,
    sourceMimeType: "image/png",
  };
}
