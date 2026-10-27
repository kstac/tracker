import {addDays, IsoDate} from '@/lib/dates';
import {DailyData} from '@/metrics/types';
import {Score} from '@/insights/types';
import {computeBaseline, windowPoints} from '@/insights/baseline';
import {ramp} from '@/insights/stats';
import {combine, WeightedContributor} from '@/insights/score';

export const ACTIVITY_WEIGHTS = {
  steps: 0.25,
  activeCalories: 0.15,
  trainingFrequency: 0.2,
  trainingVolume: 0.2,
  recovery: 0.2,
};

export const DEFAULT_STEP_GOAL = 8000;
export const WEEKLY_INTENSITY_TARGET = 150;
export const TRAINING_DAY_MIN = 20;
export const EASY_DAY_MAX_MIN = 10;

/** Your fixed goal if set, otherwise the goal Garmin set for that day (it adapts), otherwise 8,000. */
export function stepGoalFor(daily: DailyData, date: IsoDate, fixed?: number | null): number {
  if (fixed) return fixed;
  const garmin = daily.garmin_step_goal?.get(date) ?? daily.garmin_step_goal?.get(addDays(date, -1));
  return garmin && garmin > 0 ? garmin : DEFAULT_STEP_GOAL;
}

export type ActivityInput = {date: IsoDate; daily: DailyData; stepGoal?: number | null};

/** Training minutes for each of the last 7 days. Garmin intensity minutes win; Health Connect exercise only fills days Garmin has no value for. */
function weeklyLoad(daily: DailyData, date: IsoDate): number[] | null {
  const days: number[] = [];
  let any = false;
  for (let i = 6; i >= 0; i--) {
    const d = addDays(date, -i);
    const intensity = daily.intensity_min?.get(d);
    const exercise = daily.exercise_min?.get(d);
    if (intensity != null || exercise != null) any = true;
    days.push(intensity ?? exercise ?? 0);
  }
  return any ? days : null;
}

export function scoreActivity(input: ActivityInput): Score | null {
  const {date, daily} = input;
  const goal = stepGoalFor(daily, date, input.stepGoal);
  const parts: WeightedContributor[] = [];

  const steps = daily.steps?.get(date);
  if (steps != null) {
    parts.push({
      key: 'steps',
      label: 'Daily steps',
      weight: ACTIVITY_WEIGHTS.steps,
      score: ramp(steps / goal, 0, 1),
      detail: `${Math.round(steps).toLocaleString()} of ${goal.toLocaleString()}`,
    });
  }

  const kcal = daily.active_kcal?.get(date);
  const kcalBase = computeBaseline(daily.active_kcal, addDays(date, -1));
  if (kcal != null && kcalBase.longMean != null && kcalBase.longMean > 0) {
    parts.push({
      key: 'active_calories',
      label: 'Active calories',
      weight: ACTIVITY_WEIGHTS.activeCalories,
      score: ramp(kcal / kcalBase.longMean, 0, 1),
      detail: `${Math.round(kcal)} kcal (usual ${Math.round(kcalBase.longMean)})`,
    });
  }

  const load = weeklyLoad(daily, date);
  if (load) {
    const trainingDays = load.filter((m) => m >= TRAINING_DAY_MIN).length;
    const total = load.reduce((a, b) => a + b, 0);
    const easyDays = load.filter((m) => m < EASY_DAY_MAX_MIN).length;
    const heavyWeek = total >= WEEKLY_INTENSITY_TARGET || trainingDays >= 4;
    parts.push(
      {
        key: 'training_frequency',
        label: 'Training frequency',
        weight: ACTIVITY_WEIGHTS.trainingFrequency,
        score: ramp(trainingDays, 0, 3),
        detail: `${trainingDays} training ${trainingDays === 1 ? 'day' : 'days'} this week`,
      },
      {
        key: 'training_volume',
        label: 'Training volume',
        weight: ACTIVITY_WEIGHTS.trainingVolume,
        score: ramp(total, 0, WEEKLY_INTENSITY_TARGET),
        detail: `${Math.round(total)} of ${WEEKLY_INTENSITY_TARGET} intensity minutes`,
      },
      {
        key: 'recovery_time',
        label: 'Recovery time',
        weight: ACTIVITY_WEIGHTS.recovery,
        score: heavyWeek && easyDays === 0 ? 40 : 100,
        detail: heavyWeek ? `${easyDays} easy ${easyDays === 1 ? 'day' : 'days'} in a hard week` : 'Load is moderate this week',
      },
    );
  }

  const calibrating = windowPoints(daily.steps, date, 60).length < 14;
  return combine(parts, date, calibrating);
}
