import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listSources, POST as createSource } from "./route";
import { GET as getSource, PATCH as patchSource } from "./[id]/route";
import { POST as createCandidateRoute } from "../niche-candidates/route";
import { PATCH as patchCandidateRoute } from "../niche-candidates/[id]/route";
import { POST as approveCandidateRoute } from "../niche-candidates/[id]/approve/route";
import * as service from "@/server/seed-sources";

vi.mock("@/server/seed-sources", () => ({
  createSeedSource: vi.fn(),
  listSeedSources: vi.fn(),
  getSeedSource: vi.fn(),
  updateSeedSource: vi.fn(),
  createCandidate: vi.fn(),
  updateCandidate: vi.fn(),
  approveCandidate: vi.fn(),
  CandidateStateError: class CandidateStateError extends Error {},
  InvalidCandidateNameError: class InvalidCandidateNameError extends Error {},
}));

const id = "550e8400-e29b-41d4-a716-446655440000";
const context = { params: { id } };

describe("seed source and candidate API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates and lists seed sources", async () => {
    vi.mocked(service.createSeedSource).mockResolvedValue({
      id,
      title: "Video",
    } as never);
    vi.mocked(service.listSeedSources).mockResolvedValue([
      { id, title: "Video" },
    ] as never);
    const created = await createSource(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          type: "youtube_video",
          url: "https://youtube.com/watch?v=x",
          title: "Video",
        }),
      }),
    );
    expect(created.status).toBe(201);
    expect((await listSources()).status).toBe(200);
    expect(await (await listSources()).json()).toHaveLength(1);
  });

  it("creates, rejects, and approves a candidate", async () => {
    vi.mocked(service.createCandidate).mockResolvedValue({
      id,
      status: "candidate",
    } as never);
    vi.mocked(service.updateCandidate).mockResolvedValue({
      id,
      status: "rejected",
    } as never);
    vi.mocked(service.approveCandidate).mockResolvedValue({
      candidate: { id, status: "approved" },
      niche: { id: "niche" },
      query: { query: "Racing" },
    } as never);
    expect(
      (
        await createCandidateRoute(
          new Request("http://localhost", {
            method: "POST",
            body: JSON.stringify({ seedSourceId: id, name: "Racing" }),
          }),
        )
      ).status,
    ).toBe(201);
    const rejected = await patchCandidateRoute(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ status: "rejected" }),
      }),
      context,
    );
    expect(await rejected.json()).toMatchObject({ status: "rejected" });
    const approved = await approveCandidateRoute(
      new Request("http://localhost", { method: "POST" }),
      context,
    );
    expect(await approved.json()).toMatchObject({
      candidate: { status: "approved" },
      niche: { id: "niche" },
      query: { query: "Racing" },
    });
  });

  it("returns 404 for missing sources and candidates", async () => {
    vi.mocked(service.getSeedSource).mockResolvedValue(null);
    vi.mocked(service.updateSeedSource).mockResolvedValue(null as never);
    vi.mocked(service.createCandidate).mockResolvedValue(null);
    expect(
      (await getSource(new Request("http://localhost"), context)).status,
    ).toBe(404);
    expect(
      (
        await patchSource(
          new Request("http://localhost", { method: "PATCH", body: "{}" }),
          context,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await createCandidateRoute(
          new Request("http://localhost", { method: "POST", body: "{}" }),
        )
      ).status,
    ).toBe(404);
  });

  it("returns 409 for duplicate candidates and niche slugs", async () => {
    vi.mocked(service.createCandidate).mockRejectedValue({ code: "23505" });
    expect(
      (
        await createCandidateRoute(
          new Request("http://localhost", { method: "POST", body: "{}" }),
        )
      ).status,
    ).toBe(409);
    vi.mocked(service.approveCandidate).mockRejectedValue({ code: "23505" });
    expect(
      (
        await approveCandidateRoute(
          new Request("http://localhost", { method: "POST" }),
          context,
        )
      ).status,
    ).toBe(409);
  });

});
