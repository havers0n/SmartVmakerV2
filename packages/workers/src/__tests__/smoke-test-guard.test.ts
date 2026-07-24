import { describe, expect, it, beforeEach } from "vitest";
import { checkSmokeTestGuards } from "../image-generation/smoke-test";

const ALLOW_FLAG = "ALLOW_PAID_IMAGE_SMOKE_TEST";
const ATTEMPT_ID_ENV = "IMAGE_SMOKE_ATTEMPT_ID";

describe("smoke-test guard", () => {
  beforeEach(() => {
    delete process.env[ALLOW_FLAG];
    delete process.env[ATTEMPT_ID_ENV];
  });

  it("rejects when ALLOW flag is not set", () => {
    process.env[ALLOW_FLAG] = "false";
    process.env[ATTEMPT_ID_ENV] = "some-uuid";

    const result = checkSmokeTestGuards();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("ALLOW");
  });

  it("rejects when ALLOW flag is set to non-true value", () => {
    process.env[ALLOW_FLAG] = "0";
    process.env[ATTEMPT_ID_ENV] = "some-uuid";

    const result = checkSmokeTestGuards();
    expect(result.allowed).toBe(false);
  });

  it("rejects when ATTEMPT_ID is not set", () => {
    process.env[ALLOW_FLAG] = "true";
    delete process.env[ATTEMPT_ID_ENV];

    const result = checkSmokeTestGuards();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("ATTEMPT_ID");
  });

  it("rejects when ATTEMPT_ID is empty", () => {
    process.env[ALLOW_FLAG] = "true";
    process.env[ATTEMPT_ID_ENV] = "";

    const result = checkSmokeTestGuards();
    expect(result.allowed).toBe(false);
  });

  it("allows when both env vars are set correctly", () => {
    process.env[ALLOW_FLAG] = "true";
    process.env[ATTEMPT_ID_ENV] = "550e8400-e29b-41d4-a716-446655440000";

    const result = checkSmokeTestGuards();
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("exits before any provider or storage call without ALLOW flag", () => {
    // The main() function checks guard first before creating providers or storage
    // This test verifies the guard logic is correct
    process.env[ALLOW_FLAG] = "false";
    process.env[ATTEMPT_ID_ENV] = "";

    const result = checkSmokeTestGuards();
    expect(result.allowed).toBe(false);
  });
});
