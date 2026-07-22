import { z } from "zod";

// ============================================================================
// HWAR (HelloWhoAreYou) TYPES
// ============================================================================

export const ScenarioCreate = z.object({
  topic: z.string().min(3),
  durationSec: z.number().int().min(5).max(90),
  tags: z.array(z.string()).max(12),
});

export type ScenarioCreate = z.infer<typeof ScenarioCreate>;

export interface ProjectPreview {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  scenesCount: number;
  keyframesCount: number;
  hasFinalVideo: boolean;
  contentFormat?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
  storyTemplate?: { id: string; name: string } | null;
}
