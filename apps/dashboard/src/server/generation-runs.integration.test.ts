import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import {
  generationProjects,
  generationRuns,
  scenarioArtifacts,
  scenarioGenerationAttempts,
  scenarioGenerationJobQueue,
  videoProjects,
} from "@/shared/lib/schema";
import {
  createGenerationRun,
  createVideoProject,
  GenerationFoundationError,
  getGenerationRun,
  getVideoProject,
  promoteGenerationRun,
  transitionGenerationRunOperationalState,
  updateVideoProject,
} from "./generation-runs";
import {
  enqueueScenarioGenerationAttempt,
  getScenarioAttempt,
  getScenarioExecution,
} from "./scenario-execution";

const ownerA = randomUUID();
const ownerB = randomUUID();
const madeProjects: string[] = [];
const madeLegacyProjects: string[] = [];

async function project(ownerId = ownerA, suffix = randomUUID()) {
  const row = await createVideoProject(ownerId, {
    title: `Generation run ${suffix}`,
    idea: `Prove durable generation run behavior for ${suffix}.`,
  });
  madeProjects.push(row.id);
  return row;
}

async function run(ownerId: string, projectId: string) {
  return createGenerationRun(ownerId, projectId, {});
}

async function countRuns(projectId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(generationRuns)
    .where(eq(generationRuns.projectId, projectId));
  return Number(row.count);
}

async function expectDatabaseFailure(
  query: Promise<unknown>,
  expected: { code: string; constraint?: string; message?: string },
) {
  try {
    await query;
    throw new Error("Expected database query to fail");
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    expect(cause).toMatchObject(expected);
  }
}

afterEach(async () => {
  for (const projectId of madeLegacyProjects.splice(0)) {
    await db
      .delete(generationProjects)
      .where(eq(generationProjects.id, projectId));
  }
  for (const projectId of madeProjects.splice(0)) {
    await db.delete(videoProjects).where(eq(videoProjects.id, projectId));
  }
});
afterAll(async () => {
  await getPgClient().end();
});

describe.sequential("generation run DB foundation", () => {
  it("creates durable draft runs and never rewrites an older snapshot", async () => {
    const currentProject = await project();
    const first = await run(ownerA, currentProject.id);
    expect(first).toMatchObject({
      runNumber: 1,
      status: "draft",
      stage: "scenario",
      schemaVersion: 1,
    });
    expect((first.inputSnapshot as any).production.targetDurationSeconds).toBe(
      32,
    );

    await updateVideoProject(ownerA, currentProject.id, {
      idea: "Updated idea for the next production attempt.",
      defaults: { production: { targetDurationSeconds: 48 } },
    });
    const second = await run(ownerA, currentProject.id);
    expect(second.runNumber).toBe(2);
    expect((second.projectSnapshot as any).idea).toBe(
      "Updated idea for the next production attempt.",
    );
    expect((second.inputSnapshot as any).production.targetDurationSeconds).toBe(
      48,
    );

    const [storedFirst] = await db
      .select()
      .from(generationRuns)
      .where(eq(generationRuns.id, first.id));
    expect((storedFirst.projectSnapshot as any).idea).toBe(currentProject.idea);
    expect(
      (storedFirst.inputSnapshot as any).production.targetDurationSeconds,
    ).toBe(32);
  });

  it("allocates run numbers atomically under concurrent creation", async () => {
    const currentProject = await project();
    const created = await Promise.all([
      run(ownerA, currentProject.id),
      run(ownerA, currentProject.id),
      run(ownerA, currentProject.id),
    ]);
    expect(created.map((row) => row.runNumber).sort()).toEqual([1, 2, 3]);
    expect(await countRuns(currentProject.id)).toBe(3);
  });

  it("rejects cross-owner access and leaves no partial run after a failed create", async () => {
    const currentProject = await project(ownerA);
    const before = await countRuns(currentProject.id);
    await expect(run(ownerB, currentProject.id)).rejects.toMatchObject({
      status: 404,
    } satisfies Partial<GenerationFoundationError>);
    await expect(
      createGenerationRun(ownerA, currentProject.id, {
        overrides: {
          models: { text: { provider: "minimax", modelId: "missing-model" } },
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
    } satisfies Partial<GenerationFoundationError>);
    expect(await countRuns(currentProject.id)).toBe(before);
    await expect(
      getVideoProject(ownerB, currentProject.id),
    ).rejects.toMatchObject({
      status: 404,
    } satisfies Partial<GenerationFoundationError>);
  });

  it("permits only same-project promotion in the service and the database", async () => {
    const firstProject = await project();
    const secondProject = await project();
    const firstRun = await run(ownerA, firstProject.id);
    const secondRun = await run(ownerA, secondProject.id);

    const promoted = await promoteGenerationRun(
      ownerA,
      firstProject.id,
      firstRun.id,
    );
    expect(promoted.promotedRunId).toBe(firstRun.id);
    await expect(
      promoteGenerationRun(ownerA, firstProject.id, secondRun.id),
    ).rejects.toMatchObject({
      status: 404,
    } satisfies Partial<GenerationFoundationError>);
    await expectDatabaseFailure(
      db
        .update(videoProjects)
        .set({ promotedRunId: secondRun.id })
        .where(eq(videoProjects.id, firstProject.id)),
      {
        code: "23503",
        constraint: "video_projects_promoted_run_same_project_fk",
      },
    );
    await expectDatabaseFailure(
      db
        .update(videoProjects)
        .set({ promotedRunId: randomUUID() })
        .where(eq(videoProjects.id, firstProject.id)),
      {
        code: "23503",
        constraint: "video_projects_promoted_run_same_project_fk",
      },
    );
  });

  it("blocks every immutable field while allowing operational transitions", async () => {
    const currentProject = await project();
    const otherProject = await project();
    const created = await run(ownerA, currentProject.id);
    const queued = await transitionGenerationRunOperationalState(
      ownerA,
      currentProject.id,
      created.id,
      { status: "queued" },
    );
    expect(queued.status).toBe("queued");
    await expect(
      transitionGenerationRunOperationalState(
        ownerA,
        currentProject.id,
        created.id,
        { status: "running", inputSnapshot: { tampered: true } } as any,
      ),
    ).rejects.toThrow(/Unrecognized key/);
    const immutableUpdates = [
      () =>
        db
          .update(generationRuns)
          .set({ projectId: otherProject.id })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ runNumber: 2 })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ inputSnapshot: { tampered: true } })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ projectSnapshot: { tampered: true } })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ contentFormatSnapshot: { tampered: true } })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ storyTemplateSnapshot: { tampered: true } })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ modelSnapshot: { tampered: true } })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ promptSnapshot: { tampered: true } })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ sourceSnapshot: { tampered: true } })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ schemaVersion: 2 })
          .where(eq(generationRuns.id, created.id)),
      () =>
        db
          .update(generationRuns)
          .set({ createdAt: new Date().toISOString() })
          .where(eq(generationRuns.id, created.id)),
    ];
    for (const update of immutableUpdates) {
      await expectDatabaseFailure(update(), {
        code: "23514",
        message: "generation run snapshots are immutable",
      });
    }
    const running = await transitionGenerationRunOperationalState(
      ownerA,
      currentProject.id,
      created.id,
      { status: "running", stage: "keyframes" },
    );
    const failed = await transitionGenerationRunOperationalState(
      ownerA,
      currentProject.id,
      created.id,
      {
        status: "failed",
        stage: "keyframes",
        errorCode: "provider_unavailable",
        errorMessage: "Provider is unavailable.",
      },
    );
    expect(running.startedAt).toBeTruthy();
    expect(failed).toMatchObject({
      status: "failed",
      stage: "keyframes",
      failedStage: "keyframes",
      errorCode: "provider_unavailable",
      errorMessage: "Provider is unavailable.",
    });
    expect(failed.completedAt).toBeTruthy();
    const stored = await getGenerationRun(
      ownerA,
      currentProject.id,
      created.id,
    );
    expect(stored.status).toBe("failed");
    expect((stored.inputSnapshot as any).tampered).toBeUndefined();
  });

  it("enforces owner RLS while privileged application connections retain service access", async () => {
    const ownProject = await project(ownerA);
    const otherProject = await project(ownerB);
    await run(ownerA, ownProject.id);
    await run(ownerB, otherProject.id);
    const privileged = await db
      .select({ id: videoProjects.id })
      .from(videoProjects)
      .where(inArray(videoProjects.id, [ownProject.id, otherProject.id]));
    expect(privileged).toHaveLength(2);

    const asOwner = await db.transaction(async (tx) => {
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(
        sql`select set_config('request.jwt.claim.sub', ${ownerA}, true)`,
      );
      const projects = await tx.execute(sql`
        select id from generation_pipeline.video_projects
        where id in (${ownProject.id}::uuid, ${otherProject.id}::uuid)
        order by id
      `);
      const runs = await tx.execute(sql`
        select project_id from generation_pipeline.generation_runs
        where project_id in (${ownProject.id}::uuid, ${otherProject.id}::uuid)
        order by project_id
      `);
      return { projects, runs };
    });
    expect(asOwner.projects.rows.map((row) => row.id)).toEqual([ownProject.id]);
    expect(asOwner.runs.rows.map((row) => row.project_id)).toEqual([
      ownProject.id,
    ]);

    const withoutOwner = await db.transaction(async (tx) => {
      await tx.execute(sql`set local role authenticated`);
      return tx.execute(sql`
        select id from generation_pipeline.video_projects
        where id in (${ownProject.id}::uuid, ${otherProject.id}::uuid)
      `);
    });
    expect(withoutOwner.rows).toHaveLength(0);
  });

  it("does not alter legacy generation project records", async () => {
    const [legacy] = await db
      .insert(generationProjects)
      .values({ ownerId: ownerA, meta: { legacyProbe: true } })
      .returning();
    madeLegacyProjects.push(legacy.id);
    const currentProject = await project();
    await run(ownerA, currentProject.id);
    const [stored] = await db
      .select()
      .from(generationProjects)
      .where(
        and(
          eq(generationProjects.id, legacy.id),
          eq(generationProjects.ownerId, ownerA),
        ),
      );
    expect(stored).toMatchObject({
      id: legacy.id,
      meta: { legacyProbe: true },
    });
  });

  it("atomically enqueues one idempotent scenario attempt and queue event", async () => {
    const currentProject = await project();
    const created = await run(ownerA, currentProject.id);
    const first = await enqueueScenarioGenerationAttempt(
      ownerA,
      currentProject.id,
      created.id,
      "request-one",
    );
    const replay = await enqueueScenarioGenerationAttempt(
      ownerA,
      currentProject.id,
      created.id,
      "request-one",
    );
    expect(first.idempotentReplay).toBe(false);
    expect(replay).toMatchObject({
      idempotentReplay: true,
      attempt: { id: first.attempt.id },
    });

    const attempts = await db
      .select()
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.runId, created.id));
    const jobs = await db
      .select()
      .from(scenarioGenerationJobQueue)
      .where(eq(scenarioGenerationJobQueue.attemptId, first.attempt.id));
    expect(attempts).toHaveLength(1);
    expect(jobs).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      attemptNumber: 1,
      status: "queued",
      provider: "minimax",
    });
    expect(jobs[0].status).toBe("queued");
    const otherProject = await project();
    const otherRun = await run(ownerA, otherProject.id);
    const sameKeyOtherRun = await enqueueScenarioGenerationAttempt(
      ownerA,
      otherProject.id,
      otherRun.id,
      "request-one",
    );
    expect(sameKeyOtherRun.idempotentReplay).toBe(false);
    const attemptConstraints = await db.execute(sql`
      select conname, pg_get_constraintdef(oid) as definition
      from pg_constraint
      where conrelid = 'generation_pipeline.scenario_generation_attempts'::regclass
    `);
    expect(attemptConstraints.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "scenario_attempts_run_idempotency_unique",
          definition: expect.stringContaining(
            "UNIQUE (run_id, idempotency_key)",
          ),
        }),
      ]),
    );
    expect(
      (await getGenerationRun(ownerA, currentProject.id, created.id)).status,
    ).toBe("active");
    await expect(
      enqueueScenarioGenerationAttempt(
        ownerA,
        currentProject.id,
        created.id,
        "different-request",
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("persists only array artifacts and derives ready from the immutable artifact", async () => {
    const currentProject = await project();
    const created = await run(ownerA, currentProject.id);
    const { attempt } = await enqueueScenarioGenerationAttempt(
      ownerA,
      currentProject.id,
      created.id,
      "successful-request",
    );
    const [job] = await db
      .select()
      .from(scenarioGenerationJobQueue)
      .where(eq(scenarioGenerationJobQueue.attemptId, attempt.id));
    const now = new Date().toISOString();
    await db
      .update(scenarioGenerationJobQueue)
      .set({ status: "processing", lockedAt: now, lockedBy: randomUUID() })
      .where(eq(scenarioGenerationJobQueue.id, job.id));
    await db
      .update(scenarioGenerationAttempts)
      .set({ status: "running", startedAt: now })
      .where(eq(scenarioGenerationAttempts.id, attempt.id));

    await expectDatabaseFailure(
      db.insert(scenarioArtifacts).values({
        runId: created.id,
        attemptId: attempt.id,
        artifactType: "scenario_candidates",
        schemaVersion: 1,
        payload: "not-an-array",
        validationMetadata: { valid: true },
      }),
      { code: "23514", constraint: "scenario_artifacts_payload_check" },
    );
    const [artifact] = await db
      .insert(scenarioArtifacts)
      .values({
        runId: created.id,
        attemptId: attempt.id,
        artifactType: "scenario_candidates",
        schemaVersion: 1,
        payload: [{ title: "Validated candidate" }],
        validationMetadata: { valid: true, validator: "scenario-zod:v1" },
      })
      .returning();
    const artifactConstraints = await db.execute(sql`
      select conname
      from pg_constraint
      where conrelid = 'generation_pipeline.scenario_artifacts'::regclass
    `);
    expect(artifactConstraints.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conname: "scenario_artifacts_attempt_unique",
        }),
      ]),
    );
    await expectDatabaseFailure(
      db.insert(scenarioArtifacts).values({
        runId: created.id,
        attemptId: attempt.id,
        artifactType: "scenario_candidates",
        schemaVersion: 1,
        payload: [{ title: "Duplicate" }],
        validationMetadata: { valid: true },
      }),
      { code: "23505", constraint: "scenario_artifacts_run_unique" },
    );
    await db
      .update(scenarioGenerationAttempts)
      .set({
        status: "succeeded",
        completedAt: now,
        validationResult: { valid: true },
      })
      .where(eq(scenarioGenerationAttempts.id, attempt.id));
    await db
      .update(scenarioGenerationJobQueue)
      .set({ status: "completed", completedAt: now })
      .where(eq(scenarioGenerationJobQueue.id, job.id));

    expect(
      (await getScenarioExecution(ownerA, currentProject.id, created.id))
        .status,
    ).toBe("ready");
    await expectDatabaseFailure(
      db
        .update(scenarioArtifacts)
        .set({ payload: [] })
        .where(eq(scenarioArtifacts.id, artifact.id)),
      { code: "23514", message: "scenario artifacts are immutable" },
    );
  });

  it("retries by appending a new attempt without reopening the failed row", async () => {
    const currentProject = await project();
    const created = await run(ownerA, currentProject.id);
    const { attempt: first } = await enqueueScenarioGenerationAttempt(
      ownerA,
      currentProject.id,
      created.id,
      "failed-request",
    );
    const [job] = await db
      .select()
      .from(scenarioGenerationJobQueue)
      .where(eq(scenarioGenerationJobQueue.attemptId, first.id));
    const now = new Date().toISOString();
    await db
      .update(scenarioGenerationJobQueue)
      .set({ status: "processing", lockedAt: now, lockedBy: randomUUID() })
      .where(eq(scenarioGenerationJobQueue.id, job.id));
    await db
      .update(scenarioGenerationAttempts)
      .set({ status: "running", startedAt: now })
      .where(eq(scenarioGenerationAttempts.id, first.id));
    await db
      .update(scenarioGenerationAttempts)
      .set({
        status: "failed",
        completedAt: now,
        errorCode: "PROVIDER_FAILED",
        errorMessage: "Provider failed",
        diagnosticPayload: {
          payloadType: "string",
          payloadLength: 12,
          fragment: "safe fragment",
        },
      })
      .where(eq(scenarioGenerationAttempts.id, first.id));
    await db
      .update(scenarioGenerationJobQueue)
      .set({ status: "failed", completedAt: now, lastError: "Provider failed" })
      .where(eq(scenarioGenerationJobQueue.id, job.id));

    const safeAttempt = await db.transaction(async (tx) => {
      await tx.execute(sql`set local role authenticated`);
      await tx.execute(
        sql`select set_config('request.jwt.claim.sub', ${ownerA}, true)`,
      );
      return tx.execute(sql`
        select id, status, error_code
        from generation_pipeline.scenario_generation_attempts
        where id = ${first.id}
      `);
    });
    expect(safeAttempt.rows[0]).toMatchObject({
      status: "failed",
      error_code: "PROVIDER_FAILED",
    });
    await expectDatabaseFailure(
      db.transaction(async (tx) => {
        await tx.execute(sql`set local role authenticated`);
        await tx.execute(
          sql`select set_config('request.jwt.claim.sub', ${ownerA}, true)`,
        );
        return tx.execute(sql`
          select diagnostic_payload
          from generation_pipeline.scenario_generation_attempts
          where id = ${first.id}
        `);
      }),
      { code: "42501" },
    );

    const { attempt: second } = await enqueueScenarioGenerationAttempt(
      ownerA,
      currentProject.id,
      created.id,
      "retry-request",
    );
    expect(second.attemptNumber).toBe(2);
    const storedFirst = await db
      .select()
      .from(scenarioGenerationAttempts)
      .where(eq(scenarioGenerationAttempts.id, first.id));
    expect(storedFirst[0].status).toBe("failed");
    const execution = await getScenarioExecution(
      ownerA,
      currentProject.id,
      created.id,
    );
    expect(execution.status).toBe("queued");
    expect(execution.attempts[1]).not.toHaveProperty("diagnosticPayload");
    expect(
      await getScenarioAttempt(ownerA, currentProject.id, created.id, first.id),
    ).toMatchObject({ id: first.id, status: "failed" });
    expect(
      await getScenarioAttempt(ownerA, currentProject.id, created.id, first.id),
    ).not.toHaveProperty("diagnosticPayload");
    await expect(
      getScenarioAttempt(ownerB, currentProject.id, created.id, first.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});
