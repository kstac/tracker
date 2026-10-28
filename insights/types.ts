import {IsoDate} from '@/lib/dates';
import type {EffectsReport} from '@/insights/effects';
import type {ExperimentResult} from '@/insights/experiments';
import type {ScoreHistory} from '@/insights/history';
import type {LoadReport} from '@/insights/load';
import type {SleepPlan} from '@/insights/sleepPlan';
import type {BodyCheck} from '@/insights/vitals';
import {Activity, DailyData, Experiment, MetricId, SleepNight, StatusPeriod, Tag, TagEntry} from '@/metrics/types';

export type ScoreLabel = 'Optimal' | 'Good' | 'Fair' | 'Pay attention';

/** `impact` is how many points this contributor pulls the overall score below 100. */
export type Contributor = {key: string; label: string; score: number; detail: string; impact?: number};

export type ReadinessAction = 'go' | 'ready' | 'pace' | 'recover';

export type Score = {
  value: number;
  label: ScoreLabel;
  contributors: Contributor[];
  calibrating: boolean;
  date: IsoDate;
  /** Readiness only: what to do with the day. */
  action?: ReadinessAction;
  /** Sleep only: set when the value is Garmin's, with the app's own estimate alongside. */
  source?: 'garmin';
  appValue?: number;
};

export type InsightKind = 'warning' | 'positive' | 'info';

export type Insight = {
  id: string;
  kind: InsightKind;
  title: string;
  body: string;
  priority: number;
  metric?: MetricId;
};

export type Sex = 'male' | 'female';

export type InsightSettings = {
  /** A fixed daily step goal; unset uses Garmin's goal, then 8,000. */
  stepGoal?: number | null;
  /** A fixed nightly sleep need; unset estimates it from your history. */
  sleepNeedMin?: number | null;
  /** Wake-up targets in minutes after midnight; unset uses your usual wake time. */
  wakeWeekday?: number | null;
  wakeWeekend?: number | null;
  birthYear?: number | null;
  sex?: Sex | null;
  maxHr?: number | null;
  /** Only compare tag days with days you logged something, instead of treating every unlogged day as "no". */
  onlyJournaledDays?: boolean;
  /** Move the bedtime target earlier by at most 30 minutes a night. */
  gradualBedtime?: boolean;
};

export type InsightInput = {
  today: IsoDate;
  daily: DailyData;
  sleep: SleepNight[];
  tags: Tag[];
  tagEntries: TagEntry[];
  settings?: InsightSettings;
  activities?: Activity[];
  statuses?: StatusPeriod[];
  experiments?: Experiment[];
  /** Defaults to the current time; decides whether tonight's sleep plan is for today or tomorrow morning. */
  now?: Date;
};

export type InsightReport = {
  date: IsoDate;
  readiness: Score | null;
  sleep: Score | null;
  activity: Score | null;
  sleepScores: Map<IsoDate, number>;
  insights: Insight[];
  effects: EffectsReport;
  history: ScoreHistory;
  load: LoadReport;
  sleepPlan: SleepPlan;
  bodyCheck: BodyCheck;
  experiments: ExperimentResult[];
  status: StatusPeriod | null;
  stepGoal: number;
};
