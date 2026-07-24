import type {
  ImageProviderInput,
  ImageProviderResult,
  ProviderAdapter,
} from "@scrimspec/hwar-core";
import type { Logger } from "./shared-types.js";

const PROVIDER_ALIASES: Record<string, string> = {
  gemini: "gemini",
  google_gemini: "gemini",
  minimax: "minimax",
};

export interface RoutingProviderAdapterOptions {
  gemini?: ProviderAdapter;
  minimax?: ProviderAdapter;
  logger?: Logger;
}

export class RoutingImageProviderAdapter implements ProviderAdapter {
  private readonly adapters: Map<string, ProviderAdapter>;
  private readonly logger: Logger;

  constructor(opts: RoutingProviderAdapterOptions) {
    this.adapters = new Map();
    this.logger = opts.logger ?? console;

    if (opts.gemini) {
      this.adapters.set("gemini", opts.gemini);
    }
    if (opts.minimax) {
      this.adapters.set("minimax", opts.minimax);
    }
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  isSupported(provider: string): boolean {
    return provider in PROVIDER_ALIASES;
  }

  isConfigured(provider: string): boolean {
    const alias = PROVIDER_ALIASES[provider];
    if (!alias) return false;
    return this.adapters.has(alias);
  }

  async generate(input: ImageProviderInput): Promise<ImageProviderResult> {
    const { provider } = input;

    const alias = PROVIDER_ALIASES[provider];
    if (!alias) {
      this.logger.warn?.(
        { provider, attemptId: input.attemptId },
        "Unsupported image provider",
      );
      throw new Error("PROVIDER_NOT_SUPPORTED");
    }

    const adapter = this.adapters.get(alias);
    if (!adapter) {
      this.logger.warn?.(
        { provider, attemptId: input.attemptId },
        "Image provider not configured",
      );
      throw new Error("PROVIDER_NOT_CONFIGURED");
    }

    return adapter.generate(input);
  }
}
