import {addDays, IsoDate} from '@/lib/dates';
import {SleepNight} from '@/metrics/types';
import {InsightInput, InsightReport, Score} from '@/insights/types';
import {MIN_BASELINE_POINTS, windowValues} from '@/insights/baseline';
import {median} from '@/insights/stats';
import {asleepMinutes, scoreSleep} from '@/insights/sleepScore';
import {scoreReadiness} from '@/insights/readiness';
import {scoreActivity} from '@/insights/activity';
import {generateInsights} from '@/insights/rules';
import {computeTagEffects} from '@/insights/tagCorrelation';

export * from '@/insights/types';

/** One night per wake date; when sources overlap keep the longest recording. */
export function mainNights(nights: SleepNight[]): Map<IsoDate, SleepNight> {
  const byDate = new Map<IsoDate, SleepNight>();
  for (const n of nights) {
    const existing = byDate.get(n.date);
    if (!existing || asleepMinutes(n) > asleepMinutes(existing)) byDate.set(n.date, n);
  }
  return byDate;
}

export function computeSleepScores(input: InsightInput): Map<IsoDate, Score> {
  const scores = new Map<IsoDate, Score>();
  for (const [date, night] of mainNights(input.sleep)) {
    const priorMidpoints = windowValues(input.daily.sleep_midpoint, addDays(date, -1), 60);
    const score = scoreSleep(night, {
      efficiency: input.daily.sleep_efficiency?.get(date),
      personalMidpoint: priorMidpoints.length >= MIN_BASELINE_POINTS ? median(priorMidpoints) : null,
    });
    if (score) scores.set(date, score);
  }
  return scores;
}

export function computeInsights(input: InsightInput): InsightReport {
  const {today, daily} = input;
  const sleepScoreObjects = computeSleepScores(input);
  const sleepScores = new Map([...sleepScoreObjects].map(([d, s]) => [d, s.value]));

  const lastNight = sleepScoreObjects.get(today) ?? sleepScoreObjects.get(addDays(today, -1)) ?? null;
  const lastNightValue = lastNight?.value ?? daily.garmin_sleep_score?.get(today) ?? null;

  return {
    date: today,
    sleep: lastNight,
    readiness: scoreReadiness({date: today, daily, sleepScore: lastNightValue, sleepNeedMin: input.settings?.sleepNeedMin}),
    activity: scoreActivity({date: today, daily, stepGoal: input.settings?.stepGoal}),
    sleepScores,
    insights: generateInsights({today, daily}),
    tagEffects: computeTagEffects({today, daily, sleepScores, tags: input.tags, tagEntries: input.tagEntries}),
  };
}
export * from '@/insights/history';
export * from '@/insights/weekly';
