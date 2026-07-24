import { describe, expect, it, vi } from "vitest";
import type { ImageProviderInput, ProviderAdapter } from "@scrimspec/hwar-core";
import { RoutingImageProviderAdapter } from "../image-generation/routing-provider-adapter";

function makeInput(
  overrides?: Partial<ImageProviderInput>,
): ImageProviderInput {
  return {
    attemptId: "test-attempt-1",
    provider: "gemini",
    modelId: "gemini-2.5-flash-image",
    prompt: "A test prompt",
    settings: { aspectRatio: "16:9" },
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe("RoutingImageProviderAdapter", () => {
  it("1. routes to Gemini adapter from frozen gemini provider", async () => {
    const geminiMock: ProviderAdapter = {
      generate: vi
        .fn()
        .mockResolvedValue({ buffer: Buffer.from("gemini-png") }),
    };
    const router = new RoutingImageProviderAdapter({ gemini: geminiMock });

    const result = await router.generate(makeInput({ provider: "gemini" }));

    expect(geminiMock.generate).toHaveBeenCalledTimes(1);
    expect(result.buffer.toString()).toBe("gemini-png");
  });

  it("2. routes to Gemini adapter from frozen google_gemini provider", async () => {
    const geminiMock: ProviderAdapter = {
      generate: vi
        .fn()
        .mockResolvedValue({ buffer: Buffer.from("gemini-png") }),
    };
    const router = new RoutingImageProviderAdapter({ gemini: geminiMock });

    const result = await router.generate(
      makeInput({ provider: "google_gemini" }),
    );

    expect(geminiMock.generate).toHaveBeenCalledTimes(1);
    expect(result.buffer.toString()).toBe("gemini-png");
  });

  it("3. routes to MiniMax adapter from frozen minimax provider", async () => {
    let passedModelId = "";
    const minimaxMock: ProviderAdapter = {
      generate: vi
        .fn()
        .mockImplementation(async (input: ImageProviderInput) => {
          passedModelId = input.modelId;
          return { buffer: Buffer.from("minimax-png") };
        }),
    };
    const router = new RoutingImageProviderAdapter({ minimax: minimaxMock });

    const result = await router.generate(
      makeInput({ provider: "minimax", modelId: "image-01" }),
    );

    expect(minimaxMock.generate).toHaveBeenCalledTimes(1);
    expect(passedModelId).toBe("image-01");
    expect(result.buffer.toString()).toBe("minimax-png");
  });

  it("4. unsupported provider is rejected without network call", async () => {
    const geminiMock: ProviderAdapter = {
      generate: vi.fn().mockResolvedValue({ buffer: Buffer.from("x") }),
    };
    const router = new RoutingImageProviderAdapter({ gemini: geminiMock });

    await expect(
      router.generate(makeInput({ provider: "unknown-provider" })),
    ).rejects.toThrow("PROVIDER_NOT_SUPPORTED");

    expect(geminiMock.generate).not.toHaveBeenCalled();
  });

  it("5. missing provider configuration is rejected safely", async () => {
    const router = new RoutingImageProviderAdapter({});

    // minimax is supported but never configured
    await expect(
      router.generate(makeInput({ provider: "minimax" })),
    ).rejects.toThrow("PROVIDER_NOT_CONFIGURED");
  });

  it("6. frozen modelId is passed unchanged", async () => {
    let passedModelId = "";
    const geminiMock: ProviderAdapter = {
      generate: vi
        .fn()
        .mockImplementation(async (input: ImageProviderInput) => {
          passedModelId = input.modelId;
          return { buffer: Buffer.from("x") };
        }),
    };
    const router = new RoutingImageProviderAdapter({ gemini: geminiMock });

    await router.generate(makeInput({ modelId: "custom-gemini-model-v3" }));
    expect(passedModelId).toBe("custom-gemini-model-v3");
  });

  it("7. silent substitution is never performed", async () => {
    let passedModelId = "";
    const geminiMock: ProviderAdapter = {
      generate: vi
        .fn()
        .mockImplementation(async (input: ImageProviderInput) => {
          passedModelId = input.modelId;
          return { buffer: Buffer.from("x") };
        }),
    };
    const router = new RoutingImageProviderAdapter({ gemini: geminiMock });

    await router.generate(makeInput({ modelId: "gemini-2.5-flash-image" }));
    expect(passedModelId).toBe("gemini-2.5-flash-image");
    expect(passedModelId).not.toBe("gemini-2.0-flash-exp");
  });

  it("8. Gemini and google_gemini are both recognized", () => {
    const router = new RoutingImageProviderAdapter({});
    expect(router.isSupported("gemini")).toBe(true);
    expect(router.isSupported("google_gemini")).toBe(true);
    expect(router.isSupported("minimax")).toBe(true);
    expect(router.isSupported("unsupported")).toBe(false);
  });

  it("9. getRegisteredProviders returns only configured", () => {
    const router = new RoutingImageProviderAdapter({
      gemini: { generate: async () => ({ buffer: Buffer.from("x") }) },
    });
    expect(router.getRegisteredProviders()).toEqual(["gemini"]);
  });

  it("10. isConfigured checks alias mapping", () => {
    const router = new RoutingImageProviderAdapter({
      gemini: { generate: async () => ({ buffer: Buffer.from("x") }) },
    });
    expect(router.isConfigured("gemini")).toBe(true);
    expect(router.isConfigured("google_gemini")).toBe(true);
    expect(router.isConfigured("minimax")).toBe(false);
  });
});
