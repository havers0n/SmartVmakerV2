import { describe, expect, it } from "vitest";
import {
  computeDurationBucket,
  computeOutlierConfidence,
  computeOutlierScore,
  median,
  safeDivide,
} from "./beamng-metrics";
import { detectBeamngPatterns } from "./beamng-patterns";

describe("BeamNG analytics helpers", () => {
  it("calculates median for odd, even and empty inputs", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("divides safely", () => {
    expect(safeDivide(10, 2)).toBe(5);
    expect(safeDivide(10, 0)).toBeNull();
    expect(safeDivide(null, 2)).toBeNull();
  });

  it.each([
    [60, "shorts"],
    [61, "1_5m"],
    [300, "1_5m"],
    [301, "5_10m"],
    [600, "5_10m"],
    [601, "10m_plus"],
  ])("buckets %s seconds as %s", (seconds, bucket) =>
    expect(computeDurationBucket(seconds as number)).toBe(bucket),
  );

  it.each([
    ["Big & Small", "big_small"],
    ["Cars vs Trucks", "cars_vs"],
    ["High-Speed crashes", "high_speed"],
    ["high speed jumps", "high_speed"],
    ["Speedbumps", "speedbumps"],
    ["speed bumps", "speedbumps"],
    ["Flatbed Transportation", "flatbed_transport"],
    ["Family Crash Test", "family_crash_test"],
  ])("detects %s", (title, id) =>
    expect(detectBeamngPatterns(title).map((pattern) => pattern.id)).toContain(
      id,
    ),
  );

  it("calculates outlier score and confidence", () => {
    expect(computeOutlierScore(250, 100)).toBe(2.5);
    expect(computeOutlierScore(250, 0)).toBeNull();
    expect(computeOutlierConfidence(4)).toBe("low");
    expect(computeOutlierConfidence(5)).toBe("normal");
  });
});
