import {IsoDate} from '@/lib/dates';
import {Contributor, ReadinessAction, Score, ScoreLabel} from '@/insights/types';
import {round} from '@/insights/stats';

export type WeightedContributor = Contributor & {weight: number};

export function scoreLabel(value: number): ScoreLabel {
  if (value >= 85) return 'Optimal';
  if (value >= 70) return 'Good';
  if (value >= 60) return 'Fair';
  return 'Pay attention';
}

/** Weighted mean of the contributors that had data, so a missing input doesn't drag the score down. */
export function combine(parts: WeightedContributor[], date: IsoDate, calibrating: boolean): Score | null {
  if (parts.length === 0) return null;
  const weightSum = parts.reduce((a, p) => a + p.weight, 0);
  const value = round(parts.reduce((a, p) => a + p.score * p.weight, 0) / weightSum);
  return {
    value,
    label: scoreLabel(value),
    contributors: parts.map(({weight, ...c}) => ({...c, score: round(c.score), impact: round(((100 - c.score) * weight) / weightSum, 1)})),
    calibrating,
    date,
  };
}

export function readinessAction(value: number): ReadinessAction {
  if (value >= 85) return 'go';
  if (value >= 70) return 'ready';
  if (value >= 60) return 'pace';
  return 'recover';
}

export const ACTION_TEXT: Record<ReadinessAction, {label: string; advice: string}> = {
  go: {label: 'Go for it', advice: 'Well recovered. A good day for a hard workout or a big day.'},
  ready: {label: 'Ready', advice: 'Recovered enough for a normal day and normal training.'},
  pace: {label: 'Pace yourself', advice: 'Not fully recovered. Keep training moderate and protect tonight\'s sleep.'},
  recover: {label: 'Recover', advice: 'Your body needs rest. Keep it light and get to bed early.'},
};

/** The contributors costing the most points, biggest first. A high score only lists real drags, not rounding. */
export function topDrags(score: Score, limit = 2, minImpact = score.value >= 85 ? 4 : 1.5): Contributor[] {
  return [...score.contributors]
    .filter((c) => (c.impact ?? 0) >= minImpact)
    .sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0))
    .slice(0, limit);
}
