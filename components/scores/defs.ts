import {ScoreKind} from '@/insights';
import {MetricCategory, MetricDef} from '@/metrics/registry';
import {MetricId} from '@/metrics/types';

const def = (label: string, category: MetricCategory, icon: string): MetricDef => ({
  // TrendChart only reads display fields; scores aren't stored metrics, so the id is a placeholder.
  id: 'sleep_score' as MetricId,
  label,
  unit: '',
  category,
  rollup: 'mean',
  higherIsBetter: true,
  sources: [],
  decimals: 0,
  chart: 'line',
  icon,
  max: 100,
});

export const SCORE_DEFS: Record<ScoreKind, MetricDef> = {
  readiness: def('Readiness', 'recovery', 'battery-heart-variant'),
  sleep: def('Sleep score', 'sleep', 'power-sleep'),
  activity: def('Activity', 'activity', 'walk'),
};

export const SCORE_KINDS: ScoreKind[] = ['readiness', 'sleep', 'activity'];

export function isScoreKind(v: unknown): v is ScoreKind {
  return v === 'readiness' || v === 'sleep' || v === 'activity';
}
