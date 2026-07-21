export type DiscoveryExecutionErrorClassification = {
  code: string;
  retryable: boolean;
  quotaBlocked: boolean;
  lostLease: boolean;
  sanitizedMessage: string;
};

export class DiscoveryLeaseLostError extends Error {
  constructor() { super("Discovery step lease was lost"); this.name = "DiscoveryLeaseLostError"; }
}

export class DiscoveryConfigurationError extends Error {
  constructor(public readonly code = "youtube_not_configured") { super("YouTube is not configured"); this.name = "DiscoveryConfigurationError"; }
}

export class DiscoveryInputError extends Error {
  constructor(public readonly code: "invalid_query" | "invalid_order") { super(code === "invalid_query" ? "The discovery query is invalid" : "The discovery order is invalid"); this.name = "DiscoveryInputError"; }
}

export class DiscoveryMalformedCheckpointError extends Error {
  constructor() { super("The discovery checkpoint is malformed"); this.name = "DiscoveryMalformedCheckpointError"; }
}

export class YouTubeDiscoveryApiError extends Error {
  constructor(public readonly metadata: { status?: number; code?: string; networkCode?: string }) { super("YouTube discovery request failed"); this.name = "YouTubeDiscoveryApiError"; }
}

export class YouTubeQuotaExhaustedError extends Error {
  constructor() { super("YouTube daily quota is exhausted"); this.name = "YouTubeQuotaExhaustedError"; }
}

const classification = (code: string, retryable: boolean, quotaBlocked: boolean, lostLease: boolean, sanitizedMessage: string): DiscoveryExecutionErrorClassification => ({ code, retryable, quotaBlocked, lostLease, sanitizedMessage });

/** Maps only structured error signals to persistence-safe worker behavior. Unknown failures get bounded retries. */
export function classifyDiscoveryExecutionError(error: unknown): DiscoveryExecutionErrorClassification {
  if (error instanceof DiscoveryLeaseLostError) return classification("lease_lost", false, false, true, "Discovery step lease was lost");
  if (error instanceof DiscoveryConfigurationError) return classification(error.code, false, false, false, "YouTube is not configured");
  if (error instanceof DiscoveryInputError) return classification(error.code, false, false, false, error.message);
  if (error instanceof DiscoveryMalformedCheckpointError) return classification("malformed_checkpoint", false, false, false, error.message);
  if (error instanceof YouTubeQuotaExhaustedError) return classification("youtube_quota_exhausted", false, true, false, "YouTube daily quota is exhausted");
  if (error instanceof YouTubeDiscoveryApiError) {
    const { status, code, networkCode } = error.metadata;
    if (status === 429) return classification("rate_limited", true, false, false, "YouTube rate limit reached");
    if (status !== undefined && status >= 500 && status <= 599) return classification("upstream_5xx", true, false, false, "YouTube service is temporarily unavailable");
    if (networkCode === "ETIMEDOUT" || code === "ETIMEDOUT") return classification("network_timeout", true, false, false, "Network timeout while contacting YouTube");
    if (networkCode === "ECONNRESET" || code === "ECONNRESET") return classification("connection_reset", true, false, false, "Network connection to YouTube was reset");
  }
  return classification("internal_error", true, false, false, "An unexpected internal error occurred");
}

export type DiscoveryRetryDelayInput = { attempt: number; baseDelayMs: number; maxDelayMs: number; jitter?: number | (() => number) };

/** Exponential, deterministic-when-injected retry delay. The hard cap is always 60 seconds. */
export function calculateDiscoveryRetryDelay({ attempt, baseDelayMs, maxDelayMs, jitter = 0 }: DiscoveryRetryDelayInput) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new RangeError("attempt must be a positive integer");
  if (!Number.isFinite(baseDelayMs) || baseDelayMs <= 0) throw new RangeError("baseDelayMs must be positive");
  const cap = Math.min(60_000, Math.max(1, Number.isFinite(maxDelayMs) ? maxDelayMs : 60_000));
  const exponential = Math.min(cap, baseDelayMs * 2 ** (attempt - 1));
  const source = typeof jitter === "function" ? jitter() : 0.5;
  const range = typeof jitter === "number" ? Math.min(1, Math.max(0, jitter)) : 0.1;
  const boundedSource = Math.min(1, Math.max(0, Number.isFinite(source) ? source : 0.5));
  return Math.max(1, Math.min(60_000, Math.round(exponential * (1 + (boundedSource - 0.5) * 2 * range))));
}
