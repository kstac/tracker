import {dateRange, IsoDate} from '@/lib/dates';
import {computeSleepScores} from '@/insights/index';
import {scoreActivity} from '@/insights/activity';
import {scoreReadiness} from '@/insights/readiness';
import {InsightInput, Score} from '@/insights/types';

export type ScoreKind = 'readiness' | 'sleep' | 'activity';

export type ScorePoint = {value: number; calibrating: boolean};

export type ScoreHistoryDay = {
  date: IsoDate;
  readiness: ScorePoint | null;
  sleep: ScorePoint | null;
  activity: ScorePoint | null;
};

export type ScoreHistory = {days: ScoreHistoryDay[]; details: (date: IsoDate, kind: ScoreKind) => Score | null};

const point = (s: Score | null): ScorePoint | null => (s ? {value: s.value, calibrating: s.calibrating} : null);

/** Scores for every date in [from, to]. Each score only reads data up to its own date, as it would have on that day. */
export function computeScoreHistory(input: InsightInput, from: IsoDate, to: IsoDate): ScoreHistory {
  const sleepScores = computeSleepScores(input);
  const cache = new Map<string, Score | null>();

  const details = (date: IsoDate, kind: ScoreKind): Score | null => {
    const key = `${kind}|${date}`;
    if (cache.has(key)) return cache.get(key)!;
    let score: Score | null;
    if (kind === 'sleep') score = sleepScores.get(date) ?? null;
    else if (kind === 'activity') score = scoreActivity({date, daily: input.daily, stepGoal: input.settings?.stepGoal});
    else {
      const sleepValue = sleepScores.get(date)?.value ?? input.daily.garmin_sleep_score?.get(date) ?? null;
      score = scoreReadiness({date, daily: input.daily, sleepScore: sleepValue, sleepNeedMin: input.settings?.sleepNeedMin});
    }
    cache.set(key, score);
    return score;
  };

  const days = dateRange(from, to).map((date) => ({
    date,
    readiness: point(details(date, 'readiness')),
    sleep: point(details(date, 'sleep')),
    activity: point(details(date, 'activity')),
  }));
  return {days, details};
}
