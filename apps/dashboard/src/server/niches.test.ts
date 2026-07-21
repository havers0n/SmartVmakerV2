import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/db", () => ({
  db: { select: vi.fn(), insert: vi.fn() },
}));
vi.mock("@/shared/lib/schema", () => ({
  niches: { id: {}, name: {} },
  nicheQueries: { id: {}, nicheId: {}, createdAt: {} },
}));
import {
  buildNicheQueryGenerationPrompt,
  createNicheQuerySchema,
  createNicheSchema,
  updateNicheQuerySchema,
  generateNicheQueries,
  InvalidQueryGenerationResponseError,
  parseQuerySuggestions,
  parseBulkQueries,
} from "./niches";
import { db } from "@/shared/lib/db";

describe("niche validation", () => {
  it("applies the default niche settings", () => {
    expect(createNicheSchema.parse({ name: "Racing", slug: "racing" })).toEqual(
      {
        name: "Racing",
        slug: "racing",
        language: "en",
        maxChannelAgeMonths: 24,
      },
    );
  });

  it("rejects unsafe slugs", () => {
    expect(
      createNicheSchema.safeParse({ name: "Racing", slug: "Racing Games" })
        .success,
    ).toBe(false);
  });

  it("defaults new queries to enabled", () => {
    expect(createNicheQuerySchema.parse({ query: "sim racing" })).toEqual({
      query: "sim racing",
      isEnabled: true,
    });
  });

  it("requires an update field", () => {
    expect(updateNicheQuerySchema.safeParse({}).success).toBe(false);
    expect(updateNicheQuerySchema.safeParse({ isEnabled: false }).success).toBe(
      true,
    );
  });
});

describe("AI niche query generation", () => {
  it("builds a YouTube-search prompt and validates model JSON", () => {
    const prompt = buildNicheQueryGenerationPrompt({
      name: "AI study tools",
      existingQueries: ["AI tools for students"],
    });
    expect(prompt).toContain("YouTube search queries");
    expect(prompt).toContain("AI tools for students");
    const suggestions = Array.from({ length: 5 }, (_, index) => ({
      query: `AI study query ${index}`,
      type: "synonym",
    }));
    expect(
      parseQuerySuggestions(JSON.stringify({ queries: suggestions })),
    ).toHaveLength(5);
  });

  it("handles invalid and empty model responses safely", () => {
    expect(() => parseQuerySuggestions("not json")).toThrow(
      InvalidQueryGenerationResponseError,
    );
    expect(() => parseQuerySuggestions('{"queries":[]}')).toThrow(
      InvalidQueryGenerationResponseError,
    );
  });

  it("creates queries while skipping existing and response-internal duplicates", async () => {
    const selectResults = [
      [{ id: "550e8400-e29b-41d4-a716-446655440000", name: "AI study tools" }],
      [
        {
          id: "old",
          nicheId: "550e8400-e29b-41d4-a716-446655440000",
          query: "AI tools for students",
        },
      ],
    ];
    vi.mocked(db.select).mockImplementation(
      () =>
        ({
          from: () => ({
            where: () => ({
              limit: async () => selectResults.shift()!,
              orderBy: async () => selectResults.shift()!,
            }),
          }),
        }) as never,
    );
    vi.mocked(db.insert).mockImplementation(
      () =>
        ({
          values: (values: object) => ({
            returning: async () => [{ id: "new", ...values }],
          }),
        }) as never,
    );
    const provider = {
      generate: vi.fn().mockResolvedValue(
        JSON.stringify({
          queries: [
            { query: " AI tools for students " },
            { query: "AI study apps" },
            { query: "ai STUDY apps" },
            { query: "AI note taking tools" },
            { query: "how students use AI" },
          ],
        }),
      ),
    };
    const result = await generateNicheQueries(
      "550e8400-e29b-41d4-a716-446655440000",
      provider,
    );
    expect(result?.created.map((item) => item.query)).toEqual([
      "AI study apps",
      "AI note taking tools",
      "how students use AI",
    ]);
    expect(result?.skipped).toHaveLength(2);
  });
});

describe("parseBulkQueries", () => {
  it("splits by newline and trims whitespace", () => {
    const result = parseBulkQueries(
      "  earth stopped spinning shorts  \ngravity disappeared shorts\n\nhumans disappeared animation",
      [],
    );
    expect(result.queries).toEqual([
      "earth stopped spinning shorts",
      "gravity disappeared shorts",
      "humans disappeared animation",
    ]);
    expect(result.skippedEmpty).toBe(1);
  });

  it("removes empty lines", () => {
    const result = parseBulkQueries("a query\n\n\nanother query", []);
    expect(result.queries).toHaveLength(2);
    expect(result.skippedEmpty).toBe(2);
  });

  it("removes duplicates within batch case-insensitively", () => {
    const result = parseBulkQueries(
      "earth stopped spinning\nEARTH STOPPED SPINNING\nEarth Stopped Spinning",
      [],
    );
    expect(result.queries).toHaveLength(1);
    expect(result.queries[0]).toBe("earth stopped spinning");
    expect(result.skippedDuplicates).toHaveLength(2);
  });

  it("removes duplicates against existing queries case-insensitively", () => {
    const result = parseBulkQueries(
      "earth stopped spinning\ngravity disappeared",
      ["EARTH STOPPED SPINNING"],
    );
    expect(result.queries).toEqual(["gravity disappeared"]);
    expect(result.skippedDuplicates).toEqual(["earth stopped spinning"]);
  });

  it("returns skipped counts", () => {
    const result = parseBulkQueries(
      "query1\n\nquery2\nQUERY1\nquery3",
      ["query2"],
    );
    expect(result.queries).toEqual(["query1", "query3"]);
    expect(result.skippedDuplicates).toHaveLength(2);
    expect(result.skippedEmpty).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("preserves original useful query text", () => {
    const result = parseBulkQueries(
      "what if earth stopped spinning",
      [],
    );
    expect(result.queries).toEqual(["what if earth stopped spinning"]);
  });

  it("normalizes repeated spaces", () => {
    const result = parseBulkQueries(
      "earth   stopped   spinning",
      [],
    );
    expect(result.queries).toEqual(["earth stopped spinning"]);
  });

  it("rejects queries shorter than 2 chars", () => {
    const result = parseBulkQueries("a\nab\nabc", []);
    expect(result.queries).toEqual(["ab", "abc"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain("short");
  });

  it("rejects queries longer than 200 chars", () => {
    const result = parseBulkQueries("a".repeat(201), []);
    expect(result.queries).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain("long");
  });

  it("enforces max bulk size of 100", () => {
    const lines = Array.from({ length: 110 }, (_, i) => `query ${i}`);
    const result = parseBulkQueries(lines.join("\n"), [], 100);
    expect(result.queries).toHaveLength(100);
    expect(result.errors).toHaveLength(10);
    expect(result.errors[0].reason).toContain("Batch size");
  });

  it("handles empty input", () => {
    const result = parseBulkQueries("", []);
    expect(result.queries).toHaveLength(0);
    expect(result.skippedEmpty).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("handles input with only whitespace", () => {
    const result = parseBulkQueries("   \n  \n", []);
    expect(result.queries).toHaveLength(0);
    expect(result.skippedEmpty).toBe(3);
  });

  it("all errors include query and reason", () => {
    const result = parseBulkQueries("x", []);
    expect(result.errors).toEqual([
      { query: "x", reason: "Query too short (min 2 chars)" },
    ]);
  });
});
