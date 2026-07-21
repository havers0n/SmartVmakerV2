import { describe, expect, it } from "vitest";
import "dotenv/config";
import {
  bulkVideoAssociationSchema,
  createContentFormatSchema,
  evidenceSchema,
  videoAssociationSchema,
} from "./content-formats";

describe("content format validation", () => {
  it("rejects empty names, invalid enums, and invalid durations", () => {
    expect(createContentFormatSchema.safeParse({ name: "" }).success).toBe(
      false,
    );
    expect(
      createContentFormatSchema.safeParse({ name: "Format", status: "unknown" })
        .success,
    ).toBe(false);
    expect(
      createContentFormatSchema.safeParse({
        name: "Format",
        targetDurationMinSeconds: 20,
        targetDurationMaxSeconds: 10,
      }).success,
    ).toBe(false);
  });
  it("rejects invalid association confidence and roles", () => {
    expect(
      videoAssociationSchema.safeParse({
        videoId: "550e8400-e29b-41d4-a716-446655440000",
        confidence: 2,
      }).success,
    ).toBe(false);
    expect(
      videoAssociationSchema.safeParse({
        videoId: "550e8400-e29b-41d4-a716-446655440000",
        role: "wrong",
      }).success,
    ).toBe(false);
  });
  it("requires a statement and an object or Discovery provenance", () => {
    expect(
      evidenceSchema.safeParse({ evidenceType: "hook", statement: "" }).success,
    ).toBe(false);
    expect(
      evidenceSchema.safeParse({ evidenceType: "hook", statement: "A claim" })
        .success,
    ).toBe(false);
    expect(
      evidenceSchema.safeParse({
        evidenceType: "hook",
        statement: "A claim",
        provenance: { discoveryRunId: "550e8400-e29b-41d4-a716-446655440000" },
      }).success,
    ).toBe(true);
  });
  it("normalizes bulk duplicate handling at service boundary", () => {
    const body = {
      videoIds: ["550e8400-e29b-41d4-a716-446655440000"],
      role: "supporting",
      source: "discovery",
      discoveryRunId: "550e8400-e29b-41d4-a716-446655440001",
    };
    const parsed = bulkVideoAssociationSchema.parse(body);
    expect(parsed.discoveryRunId).toBe(body.discoveryRunId);
    expect(parsed.videoIds).toEqual(body.videoIds);
    expect(parsed.source).toBe("discovery");
    expect(
      bulkVideoAssociationSchema.safeParse({ ...body, unexpected: true })
        .success,
    ).toBe(false);
  });
});
