import { describe, expect, it } from "vitest";
import {
  calculateDiscoveryRetryDelay,
  classifyDiscoveryExecutionError,
  DiscoveryConfigurationError,
  DiscoveryInputError,
  DiscoveryLeaseLostError,
  DiscoveryMalformedCheckpointError,
  YouTubeDiscoveryApiError,
  YouTubeQuotaExhaustedError,
} from "./discovery-execution-errors";

describe("discovery execution error policy", () => {
  it.each([
    ["network timeout", new YouTubeDiscoveryApiError({ networkCode: "ETIMEDOUT" }), "network_timeout", true, false],
    ["connection reset", new YouTubeDiscoveryApiError({ networkCode: "ECONNRESET" }), "connection_reset", true, false],
    ["HTTP 429", new YouTubeDiscoveryApiError({ status: 429 }), "rate_limited", true, false],
    ["HTTP 500", new YouTubeDiscoveryApiError({ status: 500 }), "upstream_5xx", true, false],
    ["HTTP 502", new YouTubeDiscoveryApiError({ status: 502 }), "upstream_5xx", true, false],
    ["HTTP 503", new YouTubeDiscoveryApiError({ status: 503 }), "upstream_5xx", true, false],
    ["missing YouTube key", new DiscoveryConfigurationError(), "youtube_not_configured", false, false],
    ["invalid query", new DiscoveryInputError("invalid_query"), "invalid_query", false, false],
    ["invalid order", new DiscoveryInputError("invalid_order"), "invalid_order", false, false],
    ["malformed checkpoint", new DiscoveryMalformedCheckpointError(), "malformed_checkpoint", false, false],
    ["lost lease", new DiscoveryLeaseLostError(), "lease_lost", false, false],
    ["daily quota exhausted", new YouTubeQuotaExhaustedError(), "youtube_quota_exhausted", false, true],
    ["unknown internal error", new Error("private failure"), "internal_error", true, false],
  ])("classifies %s", (_name, error, code, retryable, quotaBlocked) => {
    expect(classifyDiscoveryExecutionError(error)).toMatchObject({ code, retryable, quotaBlocked });
  });

  it("does not persist secrets or upstream payloads", () => {
    const secret = new Error("key=AIzaFakeSecret Authorization: Bearer secret-token postgres://user:password@host/db headers: {cookie: x} ?access_token=token full upstream payload: {everything}");
    const message = classifyDiscoveryExecutionError(secret).sanitizedMessage;
    for (const unsafe of ["AIzaFakeSecret", "Authorization", "secret-token", "postgres://", "headers", "access_token", "everything"]) expect(message).not.toContain(unsafe);
  });
});

describe("discovery retry backoff", () => {
  const delay = (attempt: number, jitter: number | (() => number) = 0) => calculateDiscoveryRetryDelay({ attempt, baseDelayMs: 1_000, maxDelayMs: 999_999, jitter });
  it("grows exponentially from attempt one and caps at 60 seconds", () => {
    expect(delay(1)).toBe(1_000); expect(delay(2)).toBe(2_000); expect(delay(3)).toBe(4_000); expect(delay(99)).toBe(60_000);
  });
  it("keeps deterministic jitter bounded and repeatable", () => {
    const one = delay(3, () => 1); const zero = delay(3, () => 0);
    expect(one).toBe(delay(3, () => 1)); expect(zero).toBe(delay(3, () => 0));
    expect(zero).toBeGreaterThanOrEqual(3_600); expect(one).toBeLessThanOrEqual(4_400); expect(one).toBeLessThanOrEqual(60_000);
  });
  it("rejects invalid attempts and never yields a tight-loop delay", () => {
    expect(() => delay(0)).toThrow(RangeError); expect(delay(1)).toBeGreaterThan(0);
  });
});
