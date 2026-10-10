import {IsoDate} from '@/lib/dates';
import {Contributor, Score, ScoreLabel} from '@/insights/types';
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
    contributors: parts.map(({weight: _weight, ...c}) => ({...c, score: round(c.score)})),
    calibrating,
    date,
  };
}
