import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/db", () => ({ db: { transaction: vi.fn() } }));
vi.mock("@/shared/lib/schema", () => ({
  nicheCandidates: { id: "candidate.id" },
  nicheQueries: { table: "queries" },
  niches: { table: "niches" },
  seedSources: {},
}));
import { db } from "@/shared/lib/db";
import { nicheCandidates, nicheQueries, niches } from "@/shared/lib/schema";
import {
  approveCandidate,
  buildNicheExtractionPrompt,
  createCandidateSchema,
  createSeedSourceSchema,
  InvalidModelResponseError,
  parseExtractedCandidates,
  slugifyNiche,
  updateCandidateSchema,
} from "./seed-sources";

describe("AI niche extraction", () => {
  it("builds a prompt from source fields without requesting remote content", () => {
    const prompt = buildNicheExtractionPrompt({
      type: "youtube_video",
      title: "AI study workflows",
      notes: "Tools used by university students",
      url: "https://youtube.com/watch?v=test",
    });
    expect(prompt).toContain("AI study workflows");
    expect(prompt).toContain("Tools used by university students");
    expect(prompt).toContain("URL (context only; do not fetch it)");
    expect(prompt).toContain("AI tools for students");
    expect(prompt).toContain("Return JSON only");
  });

  it("parses 5-20 candidates and preserves response-only confidence", () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      name: `Niche ${index}`,
      description: `Description ${index}`,
      confidence: 0.8,
    }));
    expect(parseExtractedCandidates(JSON.stringify({ candidates }))).toEqual(
      candidates,
    );
  });

  it("handles invalid model JSON safely", () => {
    expect(() => parseExtractedCandidates("not json")).toThrow(
      InvalidModelResponseError,
    );
    expect(() =>
      parseExtractedCandidates(JSON.stringify({ candidates: [] })),
    ).toThrow(InvalidModelResponseError);
  });
});

describe("seed source validation", () => {
  it("requires URLs for YouTube sources", () => {
    expect(
      createSeedSourceSchema.safeParse({
        type: "youtube_video",
        title: "Video",
      }).success,
    ).toBe(false);
    expect(
      createSeedSourceSchema.safeParse({
        type: "youtube_channel",
        url: "https://youtube.com/@test",
        title: "Channel",
      }).success,
    ).toBe(true);
  });

  it("does not allow a manual source URL", () => {
    expect(
      createSeedSourceSchema.safeParse({
        type: "manual",
        url: "https://example.com",
        title: "Note",
      }).success,
    ).toBe(false);
  });

  it("validates candidates and prevents approval through the generic patch", () => {
    expect(
      createCandidateSchema.safeParse({
        seedSourceId: "not-a-uuid",
        name: "Racing",
      }).success,
    ).toBe(false);
    expect(
      updateCandidateSchema.safeParse({ status: "approved" }).success,
    ).toBe(false);
    expect(
      updateCandidateSchema.safeParse({ status: "rejected" }).success,
    ).toBe(true);
  });

  it("creates stable niche slugs", () => {
    expect(slugifyNiche("Café Racing & Builds")).toBe("cafe-racing-builds");
  });

  it("approves atomically by creating a niche and its default query", async () => {
    const insert = vi.fn((table: unknown) => ({
      values: vi.fn((values: Record<string, unknown>) => ({
        returning: vi
          .fn()
          .mockResolvedValue(
            table === niches
              ? [{ id: "niche-1", ...values }]
              : [{ id: "query-1", ...values }],
          ),
      })),
    }));
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: "candidate-1", name: "Racing", status: "candidate" },
              ]),
          })),
        })),
      })),
      insert,
      update: vi.fn(() => ({
        set: vi.fn((values: object) => ({
          where: vi.fn(() => ({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: "candidate-1", ...values }]),
          })),
        })),
      })),
    };
    (db.transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await approveCandidate(
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(insert).toHaveBeenNthCalledWith(1, niches);
    expect(insert).toHaveBeenNthCalledWith(2, nicheQueries);
    expect(result).toMatchObject({
      niche: { slug: "racing" },
      query: { nicheId: "niche-1", query: "Racing" },
      candidate: { status: "approved" },
      generatedQueries: [],
    });
    expect(result).toMatchObject({
      warning: expect.stringContaining("Niche approved, but query generation failed"),
    });
    expect(tx.update).toHaveBeenCalledWith(nicheCandidates);
  });
});
