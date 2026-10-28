import {addDays, IsoDate} from '@/lib/dates';
import {SleepNight} from '@/metrics/types';
import {InsightInput, Score} from '@/insights/types';
import {MIN_BASELINE_POINTS, windowValues} from '@/insights/baseline';
import {median, round} from '@/insights/stats';
import {scoreLabel} from '@/insights/score';
import {asleepMinutes, scoreSleep} from '@/insights/sleepScore';

/** One night per wake date; when sources overlap keep the longest recording. */
export function mainNights(nights: SleepNight[]): Map<IsoDate, SleepNight> {
  const byDate = new Map<IsoDate, SleepNight>();
  for (const n of nights) {
    const existing = byDate.get(n.date);
    if (!existing || asleepMinutes(n) > asleepMinutes(existing)) byDate.set(n.date, n);
  }
  return byDate;
}

/** Garmin's score wins when it has one so the app agrees with the watch; the breakdown is always the app's own, since Garmin doesn't share its parts. */
export function computeSleepScores(input: Pick<InsightInput, 'sleep' | 'daily'>): Map<IsoDate, Score> {
  const scores = new Map<IsoDate, Score>();
  for (const [date, night] of mainNights(input.sleep)) {
    const priorMidpoints = windowValues(input.daily.sleep_midpoint, addDays(date, -1), 60);
    const score = scoreSleep(night, {
      efficiency: input.daily.sleep_efficiency?.get(date),
      personalMidpoint: priorMidpoints.length >= MIN_BASELINE_POINTS ? median(priorMidpoints) : null,
      sleepStress: input.daily.sleep_stress?.get(date),
      wakeBattery: input.daily.body_battery_wake?.get(date),
    });
    if (!score) continue;
    const garmin = input.daily.garmin_sleep_score?.get(date);
    if (garmin == null) scores.set(date, score);
    else scores.set(date, {...score, value: round(garmin), label: scoreLabel(round(garmin)), source: 'garmin', appValue: score.value});
  }
  return scores;
}
