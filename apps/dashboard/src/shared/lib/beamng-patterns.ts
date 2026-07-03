export interface BeamngPattern {
  id: string;
  label: string;
  phrases: string[];
}

export const BEAMNG_PATTERNS: BeamngPattern[] = [
  { id: "big_small", label: "Big & Small", phrases: ["big and small"] },
  { id: "cars_vs", label: "Cars vs", phrases: ["cars vs"] },
  { id: "train", label: "Train", phrases: ["train"] },
  { id: "tornado", label: "Tornado", phrases: ["tornado"] },
  { id: "high_speed", label: "High-Speed", phrases: ["high speed"] },
  { id: "realistic", label: "Realistic", phrases: ["realistic"] },
  { id: "survival", label: "Survival", phrases: ["survival"] },
  {
    id: "family_crash_test",
    label: "Family Crash Test",
    phrases: ["family crash test"],
  },
  {
    id: "flatbed_transport",
    label: "Flatbed / Transportation",
    phrases: [
      "flatbed transportation",
      "flatbed transport",
      "flatbed",
      "transportation",
    ],
  },
  { id: "damage_cost", label: "Damage Cost", phrases: ["damage cost"] },
  { id: "police", label: "Police", phrases: ["police"] },
  { id: "logs", label: "Logs", phrases: ["logs"] },
  { id: "stairs", label: "Stairs", phrases: ["stairs"] },
  {
    id: "unfinished_road",
    label: "Unfinished Road",
    phrases: ["unfinished road"],
  },
  {
    id: "speedbumps",
    label: "Speedbumps",
    phrases: ["speedbumps", "speed bumps"],
  },
  { id: "mcqueen", label: "McQueen", phrases: ["mcqueen"] },
  {
    id: "spiderman",
    label: "Spider-Man",
    phrases: ["spider man", "spiderman"],
  },
  { id: "monster_truck", label: "Monster Truck", phrases: ["monster truck"] },
];

export const OTHER_PATTERN = { id: "other", label: "Other" } as const;

export function normalizePatternText(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[\u2010-\u2015_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectBeamngPatterns(
  title: string,
): Array<{ id: string; label: string }> {
  const normalized = ` ${normalizePatternText(title)} `;
  return BEAMNG_PATTERNS.filter((pattern) =>
    pattern.phrases.some((phrase) =>
      normalized.includes(` ${normalizePatternText(phrase)} `),
    ),
  ).map(({ id, label }) => ({ id, label }));
}
