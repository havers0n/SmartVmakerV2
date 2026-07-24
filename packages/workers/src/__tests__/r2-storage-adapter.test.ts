import { describe, expect, it, vi } from "vitest";
import { createR2StorageAdapter } from "../image-generation/r2-storage-adapter";

vi.mock("@aec/storage-client", () => ({
  uploadBuffer: vi
    .fn()
    .mockResolvedValue({ key: "test-key", bucket: "test-bucket" }),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

describe("R2StorageAdapter", () => {
  it("1. accepts valid images/runs key", async () => {
    const adapter = createR2StorageAdapter();
    const key = "images/runs/run-123/attempts/attempt-456/output.png";
    const result = await adapter.put(key, Buffer.from("test"), "image/png");
    expect(result.key).toBe(key);
  });

  it("2. rejects key outside images/runs prefix", async () => {
    const adapter = createR2StorageAdapter();
    await expect(
      adapter.put("other/prefix/image.png", Buffer.from("test"), "image/png"),
    ).rejects.toThrow("must start with");
  });

  it("3. rejects key with wrong file name", async () => {
    const adapter = createR2StorageAdapter();
    await expect(
      adapter.put(
        "images/runs/run-1/attempts/a-1/out.jpg",
        Buffer.from("test"),
        "image/png",
      ),
    ).rejects.toThrow("must end with");
  });

  it("4. rejects key with insufficient path segments", async () => {
    const adapter = createR2StorageAdapter();
    await expect(
      adapter.put(
        "images/runs/run-1/attempts/",
        Buffer.from("test"),
        "image/png",
      ),
    ).rejects.toThrow("end with /output.png");
  });

  it("5. rejects oversized upload", async () => {
    const adapter = createR2StorageAdapter();
    const large = Buffer.alloc(51 * 1024 * 1024);
    await expect(
      adapter.put(
        "images/runs/r-1/attempts/a-1/output.png",
        large,
        "image/png",
      ),
    ).rejects.toThrow("exceeds maximum size");
  });

  it("6. receives deterministic key structure", async () => {
    const adapter = createR2StorageAdapter();
    const runId = "run-abc";
    const attemptId = "attempt-xyz";
    const key = `images/runs/${runId}/attempts/${attemptId}/output.png`;

    const { uploadBuffer } = await import("@aec/storage-client");
    await adapter.put(key, Buffer.from("data"), "image/png");

    expect(uploadBuffer).toHaveBeenCalledWith(
      key,
      expect.any(Buffer),
      "image/png",
    );
  });

  it("7. delete swallows errors silently", async () => {
    const { deleteObject } = await import("@aec/storage-client");
    (deleteObject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error"),
    );

    const adapter = createR2StorageAdapter();
    await expect(
      adapter.delete("images/runs/r-1/attempts/a-1/output.png"),
    ).resolves.toBeUndefined();
  });

  it("8. delete calls storage client", async () => {
    const { deleteObject } = await import("@aec/storage-client");
    const adapter = createR2StorageAdapter();

    await adapter.delete("images/runs/r-1/attempts/a-1/output.png");

    expect(deleteObject).toHaveBeenCalledWith(
      "images/runs/r-1/attempts/a-1/output.png",
    );
  });
});
