import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import {
  generationProjects,
  generationRuns,
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
});
