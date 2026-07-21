// @ts-nocheck
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getPgClient } from "@scrimspec/db";
import { db } from "@/shared/lib/db";
import {
  contentFormatVideos,
  contentFormats,
  discoveryRuns,
  nicheQueries,
  niches,
  videoDiscoveries,
  youtubeChannels,
  youtubeVideos,
} from "@/shared/lib/schema";
import * as formats from "./route";
import * as detail from "./[id]/route";
import * as archive from "./[id]/archive/route";
import * as restore from "./[id]/restore/route";
import * as videos from "./[id]/videos/route";
import * as videoMutation from "./[id]/videos/[videoId]/route";
import * as bulk from "./[id]/videos/bulk/route";
import * as channels from "./[id]/channels/route";
import * as channelMutation from "./[id]/channels/[channelId]/route";
import * as evidence from "./[id]/evidence/route";
import * as evidenceMutation from "./[id]/evidence/[evidenceId]/route";
import * as contentFormatService from "@/server/content-formats";

const made: {
  f: string[];
  v: string[];
  c: string[];
  r: string[];
  n: string[];
} = { f: [], v: [], c: [], r: [], n: [] };
const json = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
async function fixture() {
  const s = randomUUID();
  const [{ id: n }] = await db
    .insert(niches)
    .values({
      name: `api ${s}`,
      slug: `api-${s}`,
      updatedAt: new Date().toISOString(),
    })
    .returning({ id: niches.id });
  made.n.push(n);
  const [{ id: q }] = await db
    .insert(nicheQueries)
    .values({ nicheId: n, query: `q ${s}` })
    .returning({ id: nicheQueries.id });
  const [{ id: r }] = await db
    .insert(discoveryRuns)
    .values({
      nicheId: n,
      status: "completed",
      searchOrders: ["relevance"],
      totalSteps: 0,
      requestBudget: 1,
      updatedAt: new Date().toISOString(),
    })
    .returning({ id: discoveryRuns.id });
  made.r.push(r);
  const cs = await db
    .insert(youtubeChannels)
    .values(
      [0, 1].map((i) => ({ youtubeChannelId: `api-c${i}-${s}`, title: "c" })),
    )
    .returning({ id: youtubeChannels.id });
  made.c.push(...cs.map((x) => x.id));
  const vs = await db
    .insert(youtubeVideos)
    .values(
      [0, 1, 2].map((i) => ({
        youtubeId: `api-v${i}-${s}`,
        url: `https://api/${s}/${i}`,
        title: `V ${i}`,
        channelId: cs[i % 2].id,
      })),
    )
    .returning({ id: youtubeVideos.id });
  made.v.push(...vs.map((x) => x.id));
  await db
    .insert(videoDiscoveries)
    .values(
      vs
        .slice(0, 2)
        .map((v, i) => ({
          runId: r,
          videoId: v.id,
          queryId: q,
          searchOrder: "relevance",
          resultPosition: i + 1,
        })),
    );
  return { r, cs: cs.map((x) => x.id), vs: vs.map((x) => x.id) };
}
async function create(name = `Api format ${randomUUID()}`) {
  const res = await formats.POST(
    json("http://x/api/content-formats", { name }),
  );
  const body = await res.json();
  made.f.push(body.id);
  return body;
}
afterEach(async () => {
  for (const x of made.f.splice(0))
    await db.delete(contentFormats).where(eq(contentFormats.id, x));
  for (const x of made.r.splice(0))
    await db.delete(discoveryRuns).where(eq(discoveryRuns.id, x));
  for (const x of made.v.splice(0))
    await db.delete(youtubeVideos).where(eq(youtubeVideos.id, x));
  for (const x of made.c.splice(0))
    await db.delete(youtubeChannels).where(eq(youtubeChannels.id, x));
  for (const x of made.n.splice(0))
    await db.delete(niches).where(eq(niches.id, x));
});
afterAll(async () => {
  await getPgClient().end();
});

describe("Content Formats HTTP contracts", () => {
  it("creates, validates, lists, details, updates, archives and restores", async () => {
    const f = await create("HTTP Format");
    expect(f.slug).toBe("http-format");
    expect((await formats.POST(json("http://x", { name: "" }))).status).toBe(
      400,
    );
    expect(
      (await formats.POST(json("http://x", { name: "x", status: "bad" })))
        .status,
    ).toBe(400);
    expect(
      (
        await formats.GET(
          new Request("http://x/api/content-formats?search=http&limit=1"),
        )
      ).status,
    ).toBe(200);
    const d = await detail.GET(new Request("http://x"), {
      params: { id: f.id },
    });
    expect(d.status).toBe(200);
    const p = await detail.PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: f.id } },
    );
    expect((await p.json()).slug).toBe(f.slug);
    expect(
      (await detail.GET(new Request("http://x"), { params: { id: "bad" } }))
        .status,
    ).toBe(400);
    expect(
      (
        await archive.POST(new Request("http://x", { method: "POST" }), {
          params: { id: f.id },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await restore.POST(new Request("http://x", { method: "POST" }), {
          params: { id: f.id },
        })
      ).status,
    ).toBe(200);
  });
  it("maps video, bulk and channel contracts including rollback", async () => {
    const f = await create();
    const x = await fixture();
    let r = await videos.POST(
      json("http://x", {
        videoId: x.vs[0],
        role: "exemplar",
        confidence: 0.8,
        note: "n",
      }),
      { params: { id: f.id } },
    );
    expect(r.status).toBe(201);
    r = await videos.POST(json("http://x", { videoId: x.vs[0] }), {
      params: { id: f.id },
    });
    expect(r.status).toBe(201);
    expect(
      (
        await videos.POST(json("http://x", { videoId: x.vs[0], role: "bad" }), {
          params: { id: f.id },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await videos.POST(json("http://x", { videoId: randomUUID() }), {
          params: { id: f.id },
        })
      ).status,
    ).toBe(404);
    r = await bulk.POST(
      json("http://x", {
        videoIds: [x.vs[1], x.vs[1]],
        role: "supporting",
        source: "discovery",
        discoveryRunId: x.r,
      }),
      { params: { id: f.id } },
    );
    expect(r.status).toBe(200);
    const g = await create();
    const body = {
      videoIds: [x.vs[0], x.vs[2]],
      role: "supporting" as const,
      source: "discovery" as const,
      discoveryRunId: x.r,
    };
    expect(body.discoveryRunId).toBe(x.r);
    expect(body.videoIds).toEqual([x.vs[0], x.vs[2]]);
    expect(body.source).toBe("discovery");
    const parsed = contentFormatService.bulkVideoAssociationSchema.parse(body);
    expect(parsed.discoveryRunId).toBe(x.r);
    expect(parsed.videoIds).toEqual([x.vs[0], x.vs[2]]);
    expect(parsed.source).toBe("discovery");
    await expect(
      contentFormatService.bulkAttachVideosToContentFormat(g.id, parsed),
    ).rejects.toBeInstanceOf(contentFormatService.ContentFormatConflictError);
    r = await bulk.POST(json("http://x", body), { params: { id: g.id } });
    expect(r.status).toBe(409);
    expect(
      (
        await db
          .select()
          .from(contentFormatVideos)
          .where(eq(contentFormatVideos.contentFormatId, g.id))
      ).length,
    ).toBe(0);
    r = await channels.POST(
      json("http://x", { channelId: x.cs[0], role: "primary" }),
      { params: { id: f.id } },
    );
    expect(r.status).toBe(201);
    expect(
      (
        await channels.POST(
          json("http://x", { channelId: x.cs[0], confidence: 2 }),
          { params: { id: f.id } },
        )
      ).status,
    ).toBe(400);
  });
  it("maps evidence provenance and archived conflicts without leaking DB errors", async () => {
    const f = await create();
    const x = await fixture();
    expect(
      (
        await evidence.POST(
          json("http://x", {
            videoId: x.vs[0],
            evidenceType: "hook",
            statement: "Valid",
          }),
          { params: { id: f.id } },
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await evidence.POST(
          json("http://x", {
            evidenceType: "other",
            statement: "p",
            provenance: { discoveryRunId: x.r, sourceField: "title" },
          }),
          { params: { id: f.id } },
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await evidence.POST(
          json("http://x", {
            evidenceType: "other",
            statement: "p",
            provenance: { authorization: "secret" },
          }),
          { params: { id: f.id } },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await evidence.POST(
          json("http://x", {
            evidenceType: "other",
            statement: "p",
            provenance: { discoveryRunId: randomUUID() },
          }),
          { params: { id: f.id } },
        )
      ).status,
    ).toBe(404);
    await archive.POST(new Request("http://x", { method: "POST" }), {
      params: { id: f.id },
    });
    const res = await evidence.POST(
      json("http://x", {
        videoId: x.vs[0],
        evidenceType: "other",
        statement: "blocked",
      }),
      { params: { id: f.id } },
    );
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).not.toMatch(
      /select|postgres|127\.0\.0\.1/i,
    );
  });
  it("mutates and deletes video, channel and evidence associations with stable not-found contracts", async () => {
    const f = await create();
    const x = await fixture();
    await videos.POST(json("http://x", { videoId: x.vs[0] }), {
      params: { id: f.id },
    });
    let r = await videoMutation.PATCH(
      new Request("http://x", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "exemplar",
          confidence: 0.5,
          note: "updated",
          videoId: x.vs[1],
        }),
      }),
      { params: { id: f.id, videoId: x.vs[0] } },
    );
    expect(r.status).toBe(200);
    expect((await r.json()).videoId).toBe(x.vs[0]);
    expect(
      (
        await videoMutation.PATCH(
          new Request("http://x", {
            method: "PATCH",
            body: JSON.stringify({ confidence: -1 }),
            headers: { "content-type": "application/json" },
          }),
          { params: { id: f.id, videoId: x.vs[0] } },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await videoMutation.DELETE(
          new Request("http://x", { method: "DELETE" }),
          { params: { id: f.id, videoId: x.vs[0] } },
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await videoMutation.DELETE(
          new Request("http://x", { method: "DELETE" }),
          { params: { id: f.id, videoId: x.vs[0] } },
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await db
          .select()
          .from(youtubeVideos)
          .where(eq(youtubeVideos.id, x.vs[0]))
      ).length,
    ).toBe(1);
    await channels.POST(json("http://x", { channelId: x.cs[0] }), {
      params: { id: f.id },
    });
    r = await channelMutation.PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ role: "primary", note: "n" }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: f.id, channelId: x.cs[0] } },
    );
    expect(r.status).toBe(200);
    expect(
      (
        await channelMutation.DELETE(
          new Request("http://x", { method: "DELETE" }),
          { params: { id: f.id, channelId: x.cs[0] } },
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await db
          .select()
          .from(youtubeChannels)
          .where(eq(youtubeChannels.id, x.cs[0]))
      ).length,
    ).toBe(1);
    const er = await evidence.POST(
      json("http://x", {
        videoId: x.vs[1],
        evidenceType: "hook",
        statement: "old",
      }),
      { params: { id: f.id } },
    );
    const e = await er.json();
    r = await evidenceMutation.PATCH(
      new Request("http://x", {
        method: "PATCH",
        body: JSON.stringify({ statement: "new", confidence: 0.7 }),
        headers: { "content-type": "application/json" },
      }),
      { params: { id: f.id, evidenceId: e.id } },
    );
    expect(r.status).toBe(200);
    expect(
      (
        await evidenceMutation.DELETE(
          new Request("http://x", { method: "DELETE" }),
          { params: { id: f.id, evidenceId: e.id } },
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await evidenceMutation.DELETE(
          new Request("http://x", { method: "DELETE" }),
          { params: { id: f.id, evidenceId: e.id } },
        )
      ).status,
    ).toBe(404);
    expect("DELETE" in detail).toBe(false);
  });
  it("enforces bulk and mutation error matrix", async () => {
    const f = await create();
    const x = await fixture();
    const ctx = { params: { id: f.id } };
    for (const body of [
      { videoIds: [], source: "discovery", discoveryRunId: x.r },
      {
        videoIds: Array(251).fill(x.vs[0]),
        source: "discovery",
        discoveryRunId: x.r,
      },
      { videoIds: [x.vs[0]], source: "manual", discoveryRunId: x.r },
      { videoIds: [x.vs[0]], source: "discovery" },
    ])
      expect((await bulk.POST(json("http://x", body), ctx)).status).toBe(400);
    expect(
      (
        await bulk.POST(
          json("http://x", {
            videoIds: [x.vs[0]],
            source: "discovery",
            discoveryRunId: randomUUID(),
          }),
          ctx,
        )
      ).status,
    ).toBe(404);
    const unknown = await bulk.POST(
      json("http://x", {
        videoIds: [x.vs[0], randomUUID()],
        source: "discovery",
        discoveryRunId: x.r,
      }),
      ctx,
    );
    expect(unknown.status).toBe(404);
    expect(
      (
        await db
          .select()
          .from(contentFormatVideos)
          .where(eq(contentFormatVideos.contentFormatId, f.id))
      ).length,
    ).toBe(0);
    expect(
      (
        await db
          .select()
          .from(youtubeVideos)
          .where(eq(youtubeVideos.id, x.vs[2]))
      ).length,
    ).toBe(1);
    expect(
      (await db.select().from(discoveryRuns).where(eq(discoveryRuns.id, x.r)))
        .length,
    ).toBe(1);
    expect(
      (
        await db
          .select()
          .from(videoDiscoveries)
          .where(eq(videoDiscoveries.videoId, x.vs[2]))
      ).length,
    ).toBe(0);
    const nonMember = await bulk.POST(
      json("http://x", {
        videoIds: [x.vs[0], x.vs[2]],
        source: "discovery",
        discoveryRunId: x.r,
      }),
      ctx,
    );
    expect(nonMember.status).toBe(409);
    expect(
      (
        await db
          .select()
          .from(contentFormatVideos)
          .where(eq(contentFormatVideos.contentFormatId, f.id))
      ).length,
    ).toBe(0);
    await videos.POST(json("http://x", { videoId: x.vs[0] }), ctx);
    expect(
      (
        await videoMutation.PATCH(
          new Request("http://x", { method: "PATCH", body: "{}" }),
          { params: { id: "bad", videoId: x.vs[0] } },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await videoMutation.PATCH(
          new Request("http://x", { method: "PATCH", body: "{}" }),
          { params: { id: f.id, videoId: "bad" } },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await videoMutation.PATCH(
          new Request("http://x", { method: "PATCH", body: "{}" }),
          { params: { id: randomUUID(), videoId: x.vs[0] } },
        )
      ).status,
    ).toBe(404);
    await archive.POST(new Request("http://x", { method: "POST" }), ctx);
    expect(
      (
        await videoMutation.PATCH(
          new Request("http://x", { method: "PATCH", body: "{}" }),
          { params: { id: f.id, videoId: x.vs[0] } },
        )
      ).status,
    ).toBe(409);
  });
  it("sanitizes unexpected service errors", async () => {
    const spy = vi
      .spyOn(contentFormatService, "listContentFormats")
      .mockRejectedValueOnce(
        new Error(
          "SQL: select * from content_formats postgres://user:secret@127.0.0.1:54322/postgres password=secret stack trace",
        ),
      );
    const r = await formats.GET(new Request("http://x"));
    const text = JSON.stringify(await r.json());
    expect(r.status).toBe(500);
    expect(text).toBe('{"error":"Internal Server Error"}');
    expect(text).not.toMatch(
      /select|content_formats|postgres|127|password|stack/i,
    );
    spy.mockRestore();
    const f = await create();
    const x = await fixture();
    const body = {
      videoIds: [x.vs[0], x.vs[2]],
      role: "supporting" as const,
      source: "discovery" as const,
      discoveryRunId: x.r,
    };
    const parsed = contentFormatService.bulkVideoAssociationSchema.parse(body);
    const bulkSpy = vi
      .spyOn(contentFormatService, "bulkAttachVideosToContentFormat")
      .mockResolvedValueOnce({ attachedVideoIds: body.videoIds });
    const bulkResponse = await bulk.POST(json("http://x", body), {
      params: { id: f.id },
    });
    expect(bulkResponse.status).toBe(200);
    expect(bulkSpy).toHaveBeenCalledTimes(1);
    expect(bulkSpy).toHaveBeenCalledWith(f.id, parsed);
  });
});
