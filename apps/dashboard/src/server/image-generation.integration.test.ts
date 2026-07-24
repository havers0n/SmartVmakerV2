import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import {
  imageAttempts,
  imageGenerationJobQueue,
  imageGenerationRequests,
  imageArtifacts,
  scenePlans,
  scenarioArtifacts,
  scenarioGenerationAttempts,
  videoProjects,
} from "@/shared/lib/schema";
import { createGenerationRun, createVideoProject } from "./generation-runs";
import { approveScenarioCandidate } from "./scenario-approval";
import {
  enqueueImageGeneration,
  getImageGenerationStatus,
  retryImageAttempt,
  ImageGenerationError,
} from "./image-generation";
import {
  parseImageMeta,
  claimImageGenerationJob,
  processImageGenerationAttempt,
  computeStorageKey,
} from "@scrimspec/hwar-core";
import type { ProviderAdapter, StorageAdapter } from "@scrimspec/hwar-core";

const owner = randomUUID();
const projects: string[] = [];

const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02,
  0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44,
  0x41, 0x54, 0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe5,
  0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);

const candidate = {
  title: "ImageGen candidate",
  description: "A candidate for image generation tests",
  aesScore: 80,
  hookStrength: 70,
  emotionalCurve: ["tension"],
  scenes: [
    { phase: "HOOK", duration: 8, description: "Opening hook scene" },
    { phase: "BODY", duration: 12, description: "Main content scene" },
  ],
  productionPlan: {
    sceneCount: 2,
    sceneDurations: [8, 12],
    cameraMovement: "static" as const,
    framingChanges: false,
    cuts: false,
    slowMotion: false,
  },
};

describe.sequential("image-generation integration", () => {
  afterAll(async () => {
    await getPgClient().end();
  });

  afterEach(async () => {
    const ids = projects.splice(0);
    for (const id of ids) {
      await db
        .delete(videoProjects)
        .where(eq(videoProjects.id, id))
        .catch(() => {});
    }
  });

  async function fixture() {
    const project = await createVideoProject(owner, {
      title: `ImageGen ${randomUUID()}`,
      idea: "Image generation test",
    });
    projects.push(project.id);
    const run = await createGenerationRun(owner, project.id, {});
    const [attempt] = await db
      .insert(scenarioGenerationAttempts)
      .values({
        runId: run.id,
        attemptNumber: 1,
        status: "running",
        provider: "minimax",
        modelId: "minimax-m2",
        correlationId: randomUUID(),
        idempotencyKey: `attempt:${randomUUID()}`,
        startedAt: new Date().toISOString(),
      })
      .returning();
    const [artifact] = await db
      .insert(scenarioArtifacts)
      .values({
        runId: run.id,
        attemptId: attempt.id,
        artifactType: "scenario_candidates",
        payload: [candidate],
        validationMetadata: {},
      })
      .returning();
    const approval = await approveScenarioCandidate(
      owner,
      project.id,
      run.id,
      { scenarioArtifactId: artifact.id, sourceCandidateIndex: 0 },
      `approve:${randomUUID()}`,
    );
    return { project, run, approval, attempt, artifact };
  }

  describe("enqueue", () => {
    it("1. creates scene plan, request, attempts, and queue jobs", async () => {
      const { run, approval } = await fixture();
      const key = `enq:${randomUUID()}`;
      const result = await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        { approvedRevisionId: approval.revision.id },
        key,
      );

      expect(result.request).toBeDefined();
      expect(result.request.runId).toBe(run.id);
      expect(result.idempotentReplay).toBe(false);
      // 2 scenes x 2 frames = 4 attempts
      expect(result.attempts).toHaveLength(4);

      const plans = await db
        .select()
        .from(scenePlans)
        .where(eq(scenePlans.runId, run.id));
      expect(plans).toHaveLength(1);
      expect(plans[0].revisionId).toBe(approval.revision.id);

      const reqs = await db
        .select()
        .from(imageGenerationRequests)
        .where(eq(imageGenerationRequests.runId, run.id));
      expect(reqs).toHaveLength(1);

      const attempts = await db
        .select()
        .from(imageAttempts)
        .where(eq(imageAttempts.runId, run.id));
      expect(attempts).toHaveLength(4);
      expect(attempts.every((a: any) => a.status === "queued")).toBe(true);

      const jobs = await db
        .select()
        .from(imageGenerationJobQueue)
        .where(
          sql`attempt_id IN (SELECT id FROM generation_pipeline.image_attempts WHERE run_id = ${run.id})`,
        );
      expect(jobs).toHaveLength(4);
      expect(jobs.every((j: any) => j.status === "queued")).toBe(true);
    });

    it("2. explicit target subset", async () => {
      const { run, approval } = await fixture();
      const key = `enq-target:${randomUUID()}`;
      const result = await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "first" }],
        },
        key,
      );

      expect(result.attempts).toHaveLength(1);
      expect(result.attempts[0].sceneIndex).toBe(0);
      expect(result.attempts[0].frameRole).toBe("first");
    });

    it("3. idempotent enqueue returns same request", async () => {
      const { run, approval } = await fixture();
      const key = `enq-ido:${randomUUID()}`;
      const first = await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        { approvedRevisionId: approval.revision.id },
        key,
      );
      const second = await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        { approvedRevisionId: approval.revision.id },
        key,
      );

      expect(second.idempotentReplay).toBe(true);
      expect(second.request.id).toBe(first.request.id);
      expect(second.attempts).toHaveLength(first.attempts.length);
    });

    it("4. idempotency conflict with different payload", async () => {
      const { run, approval } = await fixture();
      const key = `enq-conflict:${randomUUID()}`;
      await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        { approvedRevisionId: approval.revision.id },
        key,
      );

      await expect(
        enqueueImageGeneration(
          owner,
          projects[0],
          run.id,
          {
            approvedRevisionId: approval.revision.id,
            targets: [{ sceneIndex: 0, frameRole: "first" }],
          },
          key,
        ),
      ).rejects.toThrow(ImageGenerationError);
    });

    it("5. non-current revision is rejected", async () => {
      const { run, approval } = await fixture();
      // Approve a second revision (same candidate, different revision_number)
      await approveScenarioCandidate(
        owner,
        projects[0],
        run.id,
        {
          scenarioArtifactId: approval.revision.scenarioArtifactId,
          sourceCandidateIndex: 0,
        },
        `approve2:${randomUUID()}`,
      );

      // Attempt to enqueue with the old revision
      await expect(
        enqueueImageGeneration(
          owner,
          projects[0],
          run.id,
          { approvedRevisionId: approval.revision.id },
          `enq-old:${randomUUID()}`,
        ),
      ).rejects.toThrow(ImageGenerationError);
    });

    it("6. concurrent enqueue produces sequential attempt numbers", async () => {
      const { run, approval } = await fixture();

      const key1 = `concurrent1:${randomUUID()}`;
      const key2 = `concurrent2:${randomUUID()}`;

      const result1 = await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "first" }],
        },
        key1,
      );

      const result2 = await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "first" }],
        },
        key2,
      );

      expect(result1.attempts[0].attemptNumber).toBe(1);
      expect(result2.attempts[0].attemptNumber).toBe(2);
    });
  });

  describe("worker processing", () => {
    const fakeProvider: ProviderAdapter = {
      generate: async () => MINIMAL_PNG,
    };
    const inMemoryStorage: Map<string, Buffer> & {
      keys: string[];
      put: any;
      delete: any;
    } & StorageAdapter = Object.assign(new Map<string, Buffer>(), {
      keys: [] as string[],
      put: async (key: string, buffer: Buffer, _mimeType: string) => {
        inMemoryStorage.set(key, buffer);
        inMemoryStorage.keys.push(key);
        return { key };
      },
      delete: async (key: string) => {
        inMemoryStorage.delete(key);
      },
    });

    const workerId = randomUUID();

    it("7. successful worker processing", async () => {
      const { run, approval } = await fixture();
      const key = `worker-succ:${randomUUID()}`;
      await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "first" }],
        },
        key,
      );

      const attempt = await claimImageGenerationJob(
        db,
        {
          imageAttempts,
          imageGenerationJobQueue,
          imageArtifacts,
        },
        workerId,
      );

      expect(attempt).not.toBeNull();

      const schema = { imageAttempts, imageGenerationJobQueue, imageArtifacts };
      const result = await processImageGenerationAttempt(
        { db, schema },
        attempt!,
        fakeProvider,
        inMemoryStorage,
      );

      expect(result.status).toBe("succeeded");
      expect(result.meta).toBeDefined();
      expect(result.meta!.mimeType).toBe("image/png");
      expect(result.meta!.width).toBe(1);
      expect(result.meta!.height).toBe(1);
      expect(result.meta!.byteSize).toBeGreaterThan(0);
      expect(result.meta!.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(result.storageKey).toContain(attempt!.attemptId);

      const artifacts = await db
        .select()
        .from(imageArtifacts)
        .where(eq(imageArtifacts.attemptId, attempt!.attemptId));
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].mimeType).toBe("image/png");
      expect(artifacts[0].checksum).toBe(result.meta!.checksum);
      expect(artifacts[0].storageKey).toBe(result.storageKey);

      const [updatedJob] = await db
        .select()
        .from(imageGenerationJobQueue)
        .where(eq(imageGenerationJobQueue.id, attempt!.queueJobId));
      expect(updatedJob.status).toBe("completed");

      expect(inMemoryStorage.has(result.storageKey!)).toBe(true);
    });

    it("8. provider failure", async () => {
      const { run, approval } = await fixture();
      const key = `worker-prov-fail:${randomUUID()}`;
      await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "last" }],
        },
        key,
      );

      const failingProvider: ProviderAdapter = {
        generate: async () => {
          throw new Error("Provider API error");
        },
      };

      const attempt = await claimImageGenerationJob(
        db,
        { imageAttempts, imageGenerationJobQueue, imageArtifacts },
        workerId,
      );
      expect(attempt).not.toBeNull();

      const schema = { imageAttempts, imageGenerationJobQueue, imageArtifacts };
      const result = await processImageGenerationAttempt(
        { db, schema },
        attempt!,
        failingProvider,
        inMemoryStorage,
      );

      expect(result.status).toBe("failed");
      expect(result.failureCode).toBe("PROVIDER_FAILURE");

      const artifacts = await db
        .select()
        .from(imageArtifacts)
        .where(eq(imageArtifacts.attemptId, attempt!.attemptId));
      expect(artifacts).toHaveLength(0);

      const [updatedAttempt] = await db
        .select()
        .from(imageAttempts)
        .where(eq(imageAttempts.id, attempt!.attemptId));
      expect(updatedAttempt.status).toBe("failed");
    });

    it("9. invalid PNG buffer", async () => {
      const { run, approval } = await fixture();
      const key = `worker-invalid:${randomUUID()}`;
      await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "first" }],
        },
        key,
      );

      const invalidProvider: ProviderAdapter = {
        generate: async () => Buffer.from("not a png"),
      };

      const attempt = await claimImageGenerationJob(
        db,
        { imageAttempts, imageGenerationJobQueue, imageArtifacts },
        workerId,
      );
      expect(attempt).not.toBeNull();

      const schema = { imageAttempts, imageGenerationJobQueue, imageArtifacts };
      const result = await processImageGenerationAttempt(
        { db, schema },
        attempt!,
        invalidProvider,
        inMemoryStorage,
      );

      expect(result.status).toBe("failed");
      expect(result.failureCode).toBe("INVALID_SIGNATURE");

      const artifacts = await db
        .select()
        .from(imageArtifacts)
        .where(eq(imageArtifacts.attemptId, attempt!.attemptId));
      expect(artifacts).toHaveLength(0);
    });

    it("10. storage failure", async () => {
      const { run, approval } = await fixture();
      const key = `worker-stor-fail:${randomUUID()}`;
      await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "first" }],
        },
        key,
      );

      const failingStorage: StorageAdapter = {
        put: async () => {
          throw new Error("Storage unavailable");
        },
        delete: async () => {},
      };

      const attempt = await claimImageGenerationJob(
        db,
        { imageAttempts, imageGenerationJobQueue, imageArtifacts },
        workerId,
      );
      expect(attempt).not.toBeNull();

      const schema = { imageAttempts, imageGenerationJobQueue, imageArtifacts };
      const result = await processImageGenerationAttempt(
        { db, schema },
        attempt!,
        fakeProvider,
        failingStorage,
      );

      expect(result.status).toBe("failed");
      expect(result.failureCode).toBe("STORAGE_FAILURE");

      const artifacts = await db
        .select()
        .from(imageArtifacts)
        .where(eq(imageArtifacts.attemptId, attempt!.attemptId));
      expect(artifacts).toHaveLength(0);
    });

    it("11. terminal replay skips provider and storage", async () => {
      const { run, approval } = await fixture();
      const key = `worker-replay:${randomUUID()}`;
      await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "first" }],
        },
        key,
      );

      const attempt = await claimImageGenerationJob(
        db,
        { imageAttempts, imageGenerationJobQueue, imageArtifacts },
        workerId,
      );
      expect(attempt).not.toBeNull();

      const schema = { imageAttempts, imageGenerationJobQueue, imageArtifacts };
      await processImageGenerationAttempt(
        { db, schema },
        attempt!,
        fakeProvider,
        inMemoryStorage,
      );

      const replayResult = await processImageGenerationAttempt(
        { db, schema },
        { ...attempt!, status: "succeeded", queueStatus: "completed" },
        {
          generate: async () => {
            throw new Error("Should not be called");
          },
        },
        {
          put: async () => {
            throw new Error("Should not be called");
          },
          delete: async () => {},
        },
      );

      expect(replayResult.status).toBe("succeeded");
    });
  });

  describe("retry", () => {
    it("12. manual retry creates new attempt with incremented number", async () => {
      const { run, approval } = await fixture();
      const key = `retry-orig:${randomUUID()}`;
      await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "first" }],
        },
        key,
      );

      const [original] = await db
        .select()
        .from(imageAttempts)
        .where(
          and(
            eq(imageAttempts.runId, run.id),
            eq(imageAttempts.sceneIndex, 0),
            eq(imageAttempts.frameRole, "first"),
          ),
        )
        .limit(1);
      expect(original).toBeDefined();

      // Transition through running to failed (trigger requires queued→running→failed)
      await db
        .update(imageAttempts)
        .set({ status: "running", startedAt: new Date().toISOString() })
        .where(eq(imageAttempts.id, original.id));
      await db
        .update(imageAttempts)
        .set({
          status: "failed",
          failureCode: "TEST_FAILURE",
          failureSummary: "Intentional test failure",
          completedAt: new Date().toISOString(),
        })
        .where(eq(imageAttempts.id, original.id));

      const retryKey = `retry-new:${randomUUID()}`;
      const retryResult = await retryImageAttempt(
        owner,
        projects[0],
        run.id,
        original.id,
        retryKey,
      );

      expect(retryResult.attempt.attemptNumber).toBe(2);
      expect(retryResult.attempt.status).toBe("queued");
      expect(retryResult.attempt.sceneIndex).toBe(0);
      expect(retryResult.attempt.frameRole).toBe("first");

      // Original remains unchanged
      const [unchanged] = await db
        .select()
        .from(imageAttempts)
        .where(eq(imageAttempts.id, original.id));
      expect(unchanged.status).toBe("failed");
      expect(unchanged.attemptNumber).toBe(1);
    });
  });

  describe("status query", () => {
    it("returns plans, requests, attempts with artifacts", async () => {
      const { run, approval } = await fixture();
      const key = `status:${randomUUID()}`;
      await enqueueImageGeneration(
        owner,
        projects[0],
        run.id,
        {
          approvedRevisionId: approval.revision.id,
          targets: [{ sceneIndex: 0, frameRole: "first" }],
        },
        key,
      );

      const status = await getImageGenerationStatus(owner, projects[0], run.id);
      expect(status.plans).toHaveLength(1);
      expect(status.requests).toHaveLength(1);
      expect(status.attempts).toHaveLength(1);
      expect(status.attempts[0].artifact).toBeNull();
    });
  });

  describe("remote import declarations (not called)", () => {
    it("declares parseImageMeta and computeStorageKey", () => {
      const meta = parseImageMeta(MINIMAL_PNG);
      expect(meta.width).toBe(1);
      expect(meta.height).toBe(1);

      const key = computeStorageKey("run-1", "attempt-1", "png");
      expect(key).toBe("images/runs/run-1/attempts/attempt-1/output.png");
    });
  });
});
