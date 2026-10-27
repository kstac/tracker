import {IsoDate} from '@/lib/dates';

export type Source = 'garmin' | 'health_connect' | 'import' | 'manual';

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
  | 'garmin_sleep_need'
  | 'nap_min'
  | 'sleep_score'
  | 'respiration_avg'
  | 'respiration_sleep'
  | 'spo2_avg'
  | 'spo2_low'
  | 'vo2max'
  | 'weight_kg'
  | 'body_fat_pct'
  | 'bp_systolic'
  | 'bp_diastolic'
  | 'stress_rest_min'
  | 'stress_low_min'
  | 'stress_medium_min'
  | 'stress_high_min'
  | 'sedentary_min'
  | 'active_min'
  | 'garmin_step_goal'
  | 'checkin_energy'
  | 'checkin_mood'
  | 'checkin_soreness';

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
export type Tag = {id: string; name: string; createdAt: number; unit: string | null; weeklyLimit: number | null; archived?: boolean};

export type TagUpdate = {name: string; unit: string | null; weeklyLimit: number | null};

/** `timeMin` is when it was last logged, in minutes after midnight, if it was logged on the day itself. */
export type TagEntry = {tagId: string; date: IsoDate; value: number; timeMin?: number | null};

export type Activity = {
  id: string;
  source: Source;
  /** Local date the activity started. */
  date: IsoDate;
  startTs: number;
  durationMin: number;
  type: string;
  name: string | null;
  avgHr: number | null;
  maxHr: number | null;
  kcal: number | null;
  distanceKm: number | null;
  aerobicTe: number | null;
  anaerobicTe: number | null;
  garminLoad: number | null;
  /** Minutes in heart rate zones 1–5, when the source reports them. */
  zoneMin: number[] | null;
};

export type BodyBatteryEvent = {date: IsoDate; startTs: number; durationMin: number; type: string; impact: number; feedback: string | null};

export type StatusKind = 'sick' | 'travel' | 'injured' | 'rest';

/** A stretch of days that shouldn't count as normal, e.g. illness. `end` null means still ongoing. */
export type StatusPeriod = {id: string; kind: StatusKind; start: IsoDate; end: IsoDate | null; note: string | null};

export type DayNote = {date: IsoDate; text: string};

export type ExperimentMode = 'avoid' | 'do';

export type Prediction = 'better' | 'same' | 'worse';

export type Experiment = {
  id: string;
  name: string;
  tagId: string | null;
  mode: ExperimentMode;
  start: IsoDate;
  days: number;
  prediction: Prediction | null;
  /** Outcome keys from EXPERIMENT_METRICS, the first is the main one. */
  metrics: string[];
  createdAt: number;
  endedAt: IsoDate | null;
};
