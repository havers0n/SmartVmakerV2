export const PROJECT_TABS = [
  { id: "script", label: "Scenario & Script" },
  { id: "keyframes", label: "Keyframe Gallery" },
  { id: "mission", label: "Mission Control" },
  { id: "final", label: "Final Output" },
] as const;

export type ProjectTabId = (typeof PROJECT_TABS)[number]["id"];

