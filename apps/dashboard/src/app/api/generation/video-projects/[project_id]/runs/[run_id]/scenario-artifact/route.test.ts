import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getArtifact: vi.fn(), getUser: vi.fn() }));
vi.mock("@/server/scenario-execution", () => ({
  getValidatedScenarioArtifact: mocks.getArtifact,
  ScenarioArtifactReadError: class ScenarioArtifactReadError extends Error {
    status: number;
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
      this.status = code === "SCENARIO_ARTIFACT_NOT_FOUND" ? 404 : 422;
    }
  },
}));
vi.mock("@/shared/lib/auth", () => ({
  getTrustedUserId: mocks.getUser,
  unauthorizedResponse: () => new Response("Unauthorized", { status: 401 }),
}));
vi.mock("@/server/generation-runs", () => ({
  GenerationFoundationError: class GenerationFoundationError extends Error {},
}));
import { GET } from "./route";
import { ScenarioArtifactReadError } from "@/server/scenario-execution";

const context = {
  params: { project_id: crypto.randomUUID(), run_id: crypto.randomUUID() },
};

describe("Scenario Artifact read API", () => {
  beforeEach(() => {
    mocks.getArtifact.mockReset();
    mocks.getUser.mockReturnValue(crypto.randomUUID());
  });

  it("passes the trusted owner into the ownership-checked service and returns only its safe response", async () => {
    const safe = {
      id: crypto.randomUUID(),
      runId: context.params.run_id,
      attemptId: crypto.randomUUID(),
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      scenarios: [],
    };
    mocks.getArtifact.mockResolvedValue(safe);
    const response = await GET(new Request("http://test"), context);
    expect(mocks.getArtifact).toHaveBeenCalledWith(
      mocks.getUser.mock.results[0].value,
      context.params.project_id,
      context.params.run_id,
    );
    expect(await response.json()).toEqual(safe);
  });

  it("returns a typed error for a corrupted stored payload", async () => {
    mocks.getArtifact.mockRejectedValue(
      new ScenarioArtifactReadError(
        "SCENARIO_ARTIFACT_CORRUPTED",
        "Stored scenario artifact failed validation",
      ),
    );
    const response = await GET(new Request("http://test"), context);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      code: "SCENARIO_ARTIFACT_CORRUPTED",
      error: "Stored scenario artifact failed validation",
    });
  });
});
