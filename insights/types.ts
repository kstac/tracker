import {IsoDate} from '@/lib/dates';
import {DailyData, MetricId, SleepNight, Tag, TagEntry} from '@/metrics/types';

export type ScoreLabel = 'Optimal' | 'Good' | 'Fair' | 'Pay attention';

export type Contributor = {key: string; label: string; score: number; detail: string};

export type Score = {
  value: number;
  label: ScoreLabel;
  contributors: Contributor[];
  calibrating: boolean;
  date: IsoDate;
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

export type TagEffect = {
  tagId: string;
  tagName: string;
  metric: MetricId | 'sleep_score';
  metricLabel: string;
  lag: 0 | 1;
  taggedMean: number;
  untaggedMean: number;
  diff: number;
  cohensD: number;
  nTagged: number;
  nUntagged: number;
  summary: string;
};

export type InsightSettings = {stepGoal?: number; sleepNeedMin?: number};

export type InsightInput = {
  today: IsoDate;
  daily: DailyData;
  sleep: SleepNight[];
  tags: Tag[];
  tagEntries: TagEntry[];
  settings?: InsightSettings;
};

export type InsightReport = {
  date: IsoDate;
  readiness: Score | null;
  sleep: Score | null;
  activity: Score | null;
  sleepScores: Map<IsoDate, number>;
  insights: Insight[];
  tagEffects: TagEffect[];
};
