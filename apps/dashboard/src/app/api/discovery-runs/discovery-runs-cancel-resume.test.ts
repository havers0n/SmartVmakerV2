import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as cancel } from "./[id]/cancel/route";
import { POST as resume } from "./[id]/resume/route";
import { cancelDiscoveryRun, resumeDiscoveryRun } from "@/server/discovery-runs";

vi.mock("@/server/discovery-runs", () => ({ cancelDiscoveryRun: vi.fn(), resumeDiscoveryRun: vi.fn() }));
const id = "550e8400-e29b-41d4-a716-446655440000";
const context = (value = id) => ({ params: { id: value } });

describe("discovery run cancel/resume routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns stable, sanitized cancel and resume responses", async () => {
    vi.mocked(cancelDiscoveryRun).mockResolvedValue({ id, status: "cancelled", cancelRequestedAt: "2026-01-01" } as never);
    vi.mocked(resumeDiscoveryRun).mockResolvedValue({ id, status: "queued", cancelRequestedAt: null } as never);
    const cancelled = await cancel(new Request("http://localhost"), context()); const resumed = await resume(new Request("http://localhost"), context());
    expect(cancelled.status).toBe(200); expect(resumed.status).toBe(200); expect(await cancelled.json()).not.toHaveProperty("lockedBy"); expect(await resumed.json()).not.toHaveProperty("lockExpiresAt");
    expect(cancelDiscoveryRun).toHaveBeenCalledWith(id); expect(resumeDiscoveryRun).toHaveBeenCalledWith(id);
  });

  it("uses 404 for unknown runs and a validation response for invalid ids", async () => {
    vi.mocked(cancelDiscoveryRun).mockResolvedValue(null); vi.mocked(resumeDiscoveryRun).mockResolvedValue(null);
    expect((await cancel(new Request("http://localhost"), context())).status).toBe(404); expect((await resume(new Request("http://localhost"), context())).status).toBe(404);
    vi.mocked(cancelDiscoveryRun).mockRejectedValue(new Error("uuid details must not escape")); vi.mocked(resumeDiscoveryRun).mockRejectedValue(new Error("connection details must not escape"));
    const invalidCancel = await cancel(new Request("http://localhost"), context("bad")); const invalidResume = await resume(new Request("http://localhost"), context("bad"));
    expect(invalidCancel.status).toBe(400); expect(invalidResume.status).toBe(400); expect(await invalidCancel.json()).toEqual({ error: "Invalid run id" }); expect(await invalidResume.json()).toEqual({ error: "Invalid run id" });
  });

  it("keeps completed-run resume as a stable no-op response", async () => {
    vi.mocked(resumeDiscoveryRun).mockResolvedValue({ id, status: "completed" } as never);
    expect(await (await resume(new Request("http://localhost"), context())).json()).toEqual({ id, status: "completed" });
  });
});
