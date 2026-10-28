import {addDays, IsoDate} from '@/lib/dates';
import {SleepNight} from '@/metrics/types';
import {InsightInput, Score} from '@/insights/types';
import {MIN_BASELINE_POINTS, windowValues} from '@/insights/baseline';
import {median, round} from '@/insights/stats';
import {scoreLabel} from '@/insights/score';
import {asleepMinutes, scoreSleep} from '@/insights/sleepScore';
import {calibrateSleepWeights} from '@/insights/sleepCalibration';

/** One night per wake date; when sources overlap keep the longest recording. */
export function mainNights(nights: SleepNight[]): Map<IsoDate, SleepNight> {
  const byDate = new Map<IsoDate, SleepNight>();
  for (const n of nights) {
    const existing = byDate.get(n.date);
    if (!existing || asleepMinutes(n) > asleepMinutes(existing)) byDate.set(n.date, n);
  }
  return byDate;
}

const CALIBRATION_NIGHTS = 180;

/**
 * Garmin's score wins when it has one so the app agrees with the watch; the breakdown is always the app's own, since
 * Garmin doesn't share its parts. The app's weights are tuned to recent Garmin scores, so its estimate tracks them on
 * nights Garmin misses.
 */
export function computeSleepScores(input: Pick<InsightInput, 'sleep' | 'daily'>): Map<IsoDate, Score> {
  const nights = [...mainNights(input.sleep)].sort(([a], [b]) => a.localeCompare(b));
  const options = new Map(nights.map(([date]) => {
    const priorMidpoints = windowValues(input.daily.sleep_midpoint, addDays(date, -1), 60);
    return [date, {
      efficiency: input.daily.sleep_efficiency?.get(date),
      personalMidpoint: priorMidpoints.length >= MIN_BASELINE_POINTS ? median(priorMidpoints) : null,
      sleepStress: input.daily.sleep_stress?.get(date),
      wakeBattery: input.daily.body_battery_wake?.get(date),
    }];
  }));
  const garmin = input.daily.garmin_sleep_score;

  const samples = nights.slice(-CALIBRATION_NIGHTS).flatMap(([date, night]) => {
    const g = garmin?.get(date);
    const score = g == null ? null : scoreSleep(night, options.get(date));
    return score && g != null ? [{score, garmin: g}] : [];
  });
  const calibration = calibrateSleepWeights(samples);

  const scores = new Map<IsoDate, Score>();
  for (const [date, night] of nights) {
    const score = scoreSleep(night, {...options.get(date), weights: calibration?.weights});
    if (!score) continue;
    const tuned = calibration ? {...score, calibrationNights: calibration.nights} : score;
    const g = garmin?.get(date);
    if (g == null) scores.set(date, tuned);
    else scores.set(date, {...tuned, value: round(g), label: scoreLabel(round(g)), source: 'garmin', appValue: score.value});
  }
  return scores;
}
