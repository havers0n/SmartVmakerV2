import type {
  ImageProviderInput,
  ImageProviderResult,
  ProviderAdapter,
} from "@scrimspec/hwar-core";

const PROVIDER_TIMEOUT_MS = 120_000;

function parseGeminiInlineData(inlineData: any): {
  buffer: Buffer;
  mimeType?: string;
} {
  const data = inlineData?.data;
  if (!data || typeof data !== "string") {
    throw new Error(
      "PROVIDER_INVALID_RESPONSE: Gemini response missing inlineData.data",
    );
  }
  const mimeType =
    typeof inlineData.mimeType === "string" ? inlineData.mimeType : undefined;
  const buffer = Buffer.from(data, "base64");
  if (buffer.length === 0) {
    throw new Error(
      "PROVIDER_INVALID_RESPONSE: Gemini returned empty image data",
    );
  }
  return { buffer, mimeType };
}

function parseResponseBody(responseJson: any): {
  buffer: Buffer;
  mimeType?: string;
} {
  const candidates = responseJson.candidates ?? [];
  const first = candidates[0];
  if (!first?.content?.parts) {
    throw new Error(
      "PROVIDER_INVALID_RESPONSE: Gemini response missing content parts",
    );
  }
  const inlinePart = first.content.parts.find(
    (p: any) => p.inlineData || p.inline_data,
  );
  const inlineData = inlinePart?.inlineData || inlinePart?.inline_data;
  if (!inlineData) {
    const finishReason = first.finishReason;
    if (finishReason && finishReason !== "STOP") {
      throw new Error(
        `PROVIDER_REJECTED: Gemini finished with reason: ${finishReason}`,
      );
    }
    throw new Error(
      "PROVIDER_INVALID_RESPONSE: Gemini response has no inline data",
    );
  }
  return parseGeminiInlineData(inlineData);
}

export function createGeminiProviderAdapter(): ProviderAdapter {
  return { generate };
}

async function generate(
  input: ImageProviderInput,
): Promise<ImageProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PROVIDER_NOT_CONFIGURED: Gemini API key (GEMINI_API_KEY) is not set",
    );
  }

  const modelId = input.modelId;
  if (!modelId || modelId === "unknown") {
    throw new Error(
      "PROVIDER_NOT_CONFIGURED: Frozen Gemini modelId is invalid",
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: input.prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  if (typeof input.settings.aspectRatio === "string") {
    (requestBody.generationConfig as Record<string, unknown>).imageConfig = {
      aspectRatio: input.settings.aspectRatio,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: input.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      let errMsg: string;
      try {
        const errObj = JSON.parse(errorText);
        errMsg = errObj?.error?.message ?? errorText;
      } catch {
        errMsg = errorText;
      }

      if (response.status === 429 || response.status === 403) {
        throw new Error(`PROVIDER_REJECTED: ${errMsg}`);
      }
      throw new Error(
        `PROVIDER_REJECTED: HTTP ${response.status} - ${errMsg.slice(0, 500)}`,
      );
    }

    const responseJson = await response.json();
    const { buffer, mimeType } = parseResponseBody(responseJson);

    if (buffer.length > 20 * 1024 * 1024) {
      throw new Error(
        "PROVIDER_INVALID_RESPONSE: Gemini response exceeds 20MB limit",
      );
    }

    const candidate = responseJson.candidates?.[0];
    const finishReason: string | undefined = candidate?.finishReason;

    return {
      buffer,
      providerRequestId: undefined,
      finishReason,
      sourceMimeType: mimeType ?? "image/png",
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("PROVIDER_TIMEOUT: Gemini request timed out");
    }
    throw error;
  }
}
