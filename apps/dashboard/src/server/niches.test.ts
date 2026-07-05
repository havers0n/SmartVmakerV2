import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/db", () => ({ db: {} }));
vi.mock("@/shared/lib/schema", () => ({
  niches: { id: {}, name: {} },
  nicheQueries: { id: {}, nicheId: {}, createdAt: {} },
}));
import {
  createNicheQuerySchema,
  createNicheSchema,
  updateNicheQuerySchema,
} from "./niches";

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
