export type Trend = {
  id: string;
  title: string;
  description: string;
  insights: string[];
  meta: Record<string, unknown>;
};

const TRENDS: Trend[] = [
  {
    id: 'trend-1',
    title: 'Emotional Hook Pattern',
    description: 'Using insights from 247 analyzed videos: Hook ≤ 2s, emphasis on close-up emotions',
    insights: ['Hook ≤ 2s', 'Close-up emotions', 'Payoff @ 17s median'],
    meta: {
      videosAnalyzed: 247,
      avgHookDuration: 1.8,
      avgPayoffTime: 17.2,
      topEmotions: ['anticipation', 'curiosity', 'surprise'],
    },
  },
  {
    id: 'trend-2',
    title: 'Fast-Paced Contrast',
    description: 'Quick cuts with strong contrasts perform 35% better in retention',
    insights: ['Small vs Big', 'Fast cuts (0.5-1s)', 'Problem → Solution'],
    meta: {
      videosAnalyzed: 189,
      avgCutDuration: 0.7,
      retentionBoost: 0.35,
      topContrasts: ['small_vs_big', 'problem_vs_solution', 'before_vs_after'],
    },
  },
  {
    id: 'trend-3',
    title: 'Empathy-Driven Arc',
    description: 'Stories starting with empathy show 28% higher engagement',
    insights: ['Empathy hook', 'Tension build', 'Relief payoff'],
    meta: {
      videosAnalyzed: 156,
      avgEngagementBoost: 0.28,
      topEmotions: ['empathy', 'tension', 'relief'],
      recommendedDuration: 45,
    },
  },
];

export function getTrends(): Trend[] {
  return TRENDS;
}

