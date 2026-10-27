import {addDays} from '@/lib/dates';
import {InsightInput, InsightReport} from '@/insights/types';
import {computeSleepScores} from '@/insights/sleepScores';
import {scoreReadiness} from '@/insights/readiness';
import {scoreActivity, stepGoalFor} from '@/insights/activity';
import {generateInsights} from '@/insights/rules';
import {computeEffects} from '@/insights/effects';
import {computeScoreHistory, HISTORY_DAYS} from '@/insights/history';
import {computeLoad} from '@/insights/load';
import {baselineNeed, computeSleepPlan, planWakeDate} from '@/insights/sleepPlan';
import {computeBodyCheck} from '@/insights/vitals';
import {evaluateExperiment} from '@/insights/experiments';
import {statusOn, withoutStatusDays} from '@/insights/status';

export * from '@/insights/types';
export {mainNights, computeSleepScores} from '@/insights/sleepScores';

export function computeInsights(input: InsightInput): InsightReport {
  const {today} = input;
  const now = input.now ?? new Date();
  const settings = input.settings ?? {};
  const activities = input.activities ?? [];
  const status = statusOn(input.statuses, today);
  const daily = withoutStatusDays(input.daily, input.statuses, today);
  const scoring = {...input, daily};

  const sleepScoreObjects = computeSleepScores(scoring);
  const sleepScores = new Map([...sleepScoreObjects].map(([d, s]) => [d, s.value]));
  // History scores each past day as it was, so status days keep their own values here.
  const history = computeScoreHistory(input, addDays(today, -(HISTORY_DAYS - 1)), today);

  const lastNight = sleepScoreObjects.get(today) ?? sleepScoreObjects.get(addDays(today, -1)) ?? null;
  const readinessBase = scoreReadiness({
    date: today,
    daily,
    sleepScore: lastNight?.value ?? daily.garmin_sleep_score?.get(today) ?? null,
    sleepNeedMin: baselineNeed(input.sleep, today, settings).min,
  });
  const readiness =
    readinessBase && (status?.kind === 'sick' || status?.kind === 'injured') ? {...readinessBase, action: 'recover' as const} : readinessBase;
  const activity = scoreActivity({date: today, daily, stepGoal: settings.stepGoal});

  const load = computeLoad(input.daily, activities, today, settings, readiness?.action ?? null, status?.kind ?? null);
  const loads = new Map(load.days.map((d) => [d.date, d.load]));
  const sleepPlan = computeSleepPlan({
    daily,
    nights: input.sleep,
    today,
    wakeDate: planWakeDate(today, now),
    settings,
    todayLoad: load.today?.load ?? null,
    chronicLoad: load.chronic,
  });
  const radarContext = {loads, chronicLoad: load.chronic, status: status?.kind ?? null};
  const bodyCheck = computeBodyCheck(daily, today, radarContext);

  const readinessSeries = new Map(history.days.flatMap((d) => (d.readiness ? [[d.date, d.readiness.value] as const] : [])));
  const effects = computeEffects({
    today,
    daily: input.daily,
    sleepScores,
    readiness: readinessSeries,
    tags: input.tags,
    tagEntries: input.tagEntries,
    loads,
    activities,
    statuses: input.statuses,
    onlyJournaledDays: settings.onlyJournaledDays,
  });

  const experimentInput = {today, daily: input.daily, sleepScores, readiness: readinessSeries, tags: input.tags, tagEntries: input.tagEntries};
  return {
    date: today,
    sleep: lastNight,
    readiness,
    activity,
    sleepScores,
    insights: generateInsights({today, daily, radar: radarContext, load, effects: effects.effects, status: status?.kind ?? null}),
    effects,
    history,
    load,
    sleepPlan,
    bodyCheck,
    experiments: (input.experiments ?? []).map((e) => evaluateExperiment(experimentInput, e)),
    status,
    stepGoal: stepGoalFor(daily, today, settings.stepGoal),
  };
}
export * from '@/insights/history';
export * from '@/insights/weekly';
export * from '@/insights/sleepDebt';
export * from '@/insights/sleepPlan';
export * from '@/insights/load';
export * from '@/insights/vitals';
export * from '@/insights/effects';
export * from '@/insights/experiments';
export * from '@/insights/status';
export {computeMonthReport, monthLabel, shiftMonth, monthEnd} from '@/insights/monthly';
export type {MonthReport, MonthStats, MonthTag} from '@/insights/monthly';
export {ACTION_TEXT, readinessAction, topDrags} from '@/insights/score';
