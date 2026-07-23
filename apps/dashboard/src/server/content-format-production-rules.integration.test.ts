import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import type { Scenario } from "@scrimspec/shared-types";
import { db } from "@/shared/lib/db";
import {
  contentFormats,
  scenarioArtifacts,
  videoProjects,
} from "@/shared/lib/schema";
import {
  createGenerationRun,
  createVideoProject,
  getGenerationRun,
} from "./generation-runs";
import {
  activateContentFormat,
  createContentFormat,
  updateContentFormat,
} from "./content-formats";
import { enqueueScenarioGenerationAttempt } from "./scenario-execution";
import { processScenarioJob } from "../../../../packages/workers/src/scenario-worker";

const ownerId = randomUUID();
const ids: string[] = [];
const contract = (min: number, max: number) => ({
  version: 1 as const,
  instructions: ["BeamNG"],
  timing: {
    exactSceneCount: 4,
    sceneDurationSeconds: 8,
    totalDurationSeconds: 32,
  },
  camera: {
    movement: "static" as const,
    angleDegrees: { min, max },
    framingLocked: true,
    noCuts: true,
  },
  continuity: {
    usePreviousFinalFrame: true,
    persistentWreckage: true,
    vehicleEntryDirection: "top",
    obstaclePosition: "lower-middle",
  },
  forbidden: {
    slowMotion: true,
    fireExplosions: true,
    humans: true,
    gore: true,
    hud: true,
    watermarks: true,
    textOverlays: true,
  },
});
const candidate = (): Scenario => ({
  title: "Collision",
  description:
    "Static 22 degree camera. Vehicles enter from the top into the lower-middle obstacle; previous final frame continues directly and wreckage remains.",
  aesScore: 90,
  hookStrength: 90,
  emotionalCurve: ["tension"],
  scenes: ["HOOK", "BUILD", "PAYOFF", "RESOLUTION"].map((phase) => ({
    phase,
    duration: 8,
    description:
      "Static 22 degree view; previous final frame continues directly and wreckage remains.",
  })),
  productionPlan: {
    sceneCount: 4,
    sceneDurations: [8, 8, 8, 8],
    cameraMovement: "static",
    cameraAngleDegrees: 22,
    framingChanges: false,
    cuts: false,
    slowMotion: false,
    previousFrameContinuity: true,
    persistentWreckage: true,
    vehicleEntryDirection: "top",
    obstaclePosition: "lower-middle",
  },
});

async function rawFormat(rules: unknown) {
  const id = randomUUID();
  ids.push(id);
  await db.execute(
    sql`insert into content_formats (id, name, slug, production_rules) values (${id}::uuid, ${`rules-${id}`}, ${`rules-${id}`}, ${JSON.stringify(rules)}::jsonb)`,
  );
  return id;
}
afterEach(async () => {
  for (const id of ids.splice(0))
    await db.delete(contentFormats).where(eq(contentFormats.id, id));
});
afterAll(async () => {
  await getPgClient().end();
});

describe.sequential("versioned Content Format production contracts", () => {
  it.each([[], ["legacy"], { version: 1 }, contract(20, 25)])(
    "accepts production_rules %j",
    async (rules) => {
      await rawFormat(rules);
    },
  );
  it("updates legacy arrays and v1 contracts", async () => {
    const id = await rawFormat([]);
    await db.execute(
      sql`update content_formats set production_rules = ${JSON.stringify({ version: 1 })}::jsonb where id = ${id}::uuid`,
    );
    await db.execute(
      sql`update content_formats set production_rules = ${JSON.stringify(contract(40, 45))}::jsonb where id = ${id}::uuid`,
    );
  });
  it.each([{}, { version: 2 }, "rules", 1, true, { version: "1" }])(
    "rejects production_rules %j",
    async (rules) => {
      const id = randomUUID();
      await expect(
        db.execute(
          sql`insert into content_formats (id, name, slug, production_rules) values (${id}::uuid, ${`bad-${id}`}, ${`bad-${id}`}, ${JSON.stringify(rules)}::jsonb)`,
        ),
      ).rejects.toMatchObject({
        cause: {
          code: "23514",
          constraint: "content_formats_production_rules_contract_v1_check",
        },
      });
    },
  );
  it("persists A then B through services and gives immutable behavioral Run snapshots", async () => {
    const a = contract(20, 25),
      b = contract(40, 45);
    const format = await createContentFormat({
      name: `Contract ${randomUUID()}`,
      productionRules: a,
    });
    ids.push(format.id);
    expect((await activateContentFormat(format.id)).status).toBe("active");
    expect(
      (
        await db
          .select()
          .from(contentFormats)
          .where(eq(contentFormats.id, format.id))
      )[0].productionRules,
    ).toEqual(a);
    const project = await createVideoProject(ownerId, {
      title: "Snapshot",
      idea: "Snapshot contract behavior",
      contentFormatId: format.id,
    });
    const first = await createGenerationRun(ownerId, project.id, {});
    const firstSnapshot = first.contentFormatSnapshot;
    await updateContentFormat(format.id, { productionRules: b });
    expect(
      (await getGenerationRun(ownerId, project.id, first.id))
        .contentFormatSnapshot,
    ).toEqual(firstSnapshot);
    const second = await createGenerationRun(ownerId, project.id, {});
    expect((second.contentFormatSnapshot as any).productionRules).toEqual(b);
    for (const [run, key] of [
      [first, "a"],
      [second, "b"],
    ] as const)
      await enqueueScenarioGenerationAttempt(ownerId, project.id, run.id, key);
    const fake = async () => ({
      scenarios: [candidate()],
      providerRequestId: "fake",
      finishReason: "stop",
      usage: {},
      diagnostic: {},
    });
    await processScenarioJob(fake);
    await processScenarioJob(fake);
    expect(
      await db
        .select()
        .from(scenarioArtifacts)
        .where(eq(scenarioArtifacts.runId, first.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(scenarioArtifacts)
        .where(eq(scenarioArtifacts.runId, second.id)),
    ).toHaveLength(0);
    await db.delete(videoProjects).where(eq(videoProjects.id, project.id));
  });
});
