import {IsoDate} from '@/lib/dates';

export type Source = 'garmin' | 'health_connect' | 'import';

export type MetricId =
  | 'steps'
  | 'distance_km'
  | 'active_kcal'
  | 'total_kcal'
  | 'floors'
  | 'intensity_min'
  | 'exercise_min'
  | 'resting_hr'
  | 'hr_avg'
  | 'hr_min'
  | 'hr_max'
  | 'hrv_overnight'
  | 'stress_avg'
  | 'stress_max'
  | 'sleep_stress'
  | 'body_battery_high'
  | 'body_battery_low'
  | 'body_battery_wake'
  | 'body_battery_charged'
  | 'body_battery_drained'
  | 'sleep_total_min'
  | 'sleep_deep_min'
  | 'sleep_light_min'
  | 'sleep_rem_min'
  | 'sleep_awake_min'
  | 'sleep_efficiency'
  | 'sleep_start'
  | 'sleep_end'
  | 'sleep_midpoint'
  | 'garmin_sleep_score'
  | 'sleep_score'
  | 'respiration_avg'
  | 'respiration_sleep'
  | 'spo2_avg'
  | 'spo2_low'
  | 'vo2max'
  | 'weight_kg';

export type DailyRow = {date: IsoDate; metric: MetricId; source: Source; value: number};

/** Resolved (one value per date, best source chosen) daily values keyed by metric then date. */
export type DailyData = Partial<Record<MetricId, Map<IsoDate, number>>>;

export type SleepNight = {
  /** The wake-up date, matching Garmin's calendarDate convention. */
  date: IsoDate;
  source: Source;
  startTs: number;
  endTs: number;
  deepMin: number;
  lightMin: number;
  remMin: number;
  awakeMin: number;
};

export type SampleMetric = 'heart_rate' | 'stress' | 'body_battery';

export type Sample = {metric: SampleMetric; ts: number; value: number; source: Source};

/** `unit` null means a simple count (+1 per tap); otherwise entries are amounts in that unit, e.g. mg. */
export type Tag = {id: string; name: string; createdAt: number; unit: string | null; weeklyLimit: number | null};

export type TagUpdate = {name: string; unit: string | null; weeklyLimit: number | null};

export type TagEntry = {tagId: string; date: IsoDate; value: number};
