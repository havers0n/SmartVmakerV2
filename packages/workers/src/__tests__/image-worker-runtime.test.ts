import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ProviderAdapter, StorageAdapter } from "@scrimspec/hwar-core";
import { ImageWorkerRuntime } from "../image-generation/image-worker-runtime";

vi.mock("../image-generation/recovery", () => ({
  recoverStaleImageJobs: vi
    .fn()
    .mockResolvedValue({ caseARecovered: 0, caseBRecovered: 0 }),
}));

vi.mock("@scrimspec/hwar-core", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    claimImageGenerationJob: vi.fn().mockResolvedValue(null),
  };
});

const fakeProvider: ProviderAdapter = {
  generate: vi.fn().mockResolvedValue({
    buffer: Buffer.from("x"),
    sourceMimeType: "image/png",
  }),
};
const fakeStorage: StorageAdapter = {
  put: vi.fn().mockResolvedValue({ key: "test" }),
  delete: vi.fn().mockResolvedValue(undefined),
};

function mockDb() {
  return {
    $client: { end: vi.fn().mockResolvedValue(undefined) },
  };
}

describe("ImageWorkerRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    "1. graceful shutdown stops claiming new jobs",
    { timeout: 10_000 },
    async () => {
      const db = mockDb();
      const runtime = new ImageWorkerRuntime({
        db,
        provider: fakeProvider,
        storage: fakeStorage,
        pollIntervalMs: 5,
        recoveryIntervalMs: 999999,
      });

      setTimeout(() => runtime.requestShutdown(), 100);
      await runtime.run();

      expect(runtime.isShutdownRequested()).toBe(true);
    },
  );

  it("2. shutdown is idempotent", () => {
    const runtime = new ImageWorkerRuntime({
      db: mockDb(),
      provider: fakeProvider,
      storage: fakeStorage,
    });

    runtime.requestShutdown();
    runtime.requestShutdown();

    expect(runtime.isShutdownRequested()).toBe(true);
  });

  it("3. workerId is generated if not provided", () => {
    const runtime = new ImageWorkerRuntime({
      db: mockDb(),
      provider: fakeProvider,
      storage: fakeStorage,
    });

    expect(runtime.getWorkerId()).toBeTruthy();
    expect(runtime.getWorkerId()).toMatch(/^[0-9a-f-]+$/);
  });

  it("4. uses provided workerId", () => {
    const runtime = new ImageWorkerRuntime({
      db: mockDb(),
      provider: fakeProvider,
      storage: fakeStorage,
      workerId: "my-custom-id",
    });

    expect(runtime.getWorkerId()).toBe("my-custom-id");
  });

  it("5. recovery is called at startup", { timeout: 10_000 }, async () => {
    const { recoverStaleImageJobs } = await import(
      "../image-generation/recovery"
    );
    const db = mockDb();
    const runtime = new ImageWorkerRuntime({
      db,
      provider: fakeProvider,
      storage: fakeStorage,
      pollIntervalMs: 5,
      recoveryIntervalMs: 1,
    });

    setTimeout(() => runtime.requestShutdown(), 100);
    await runtime.run();

    expect(recoverStaleImageJobs).toHaveBeenCalled();
  });
});
