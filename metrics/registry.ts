import {MetricId, Source} from '@/metrics/types';

export type MetricCategory = 'activity' | 'heart' | 'sleep' | 'recovery' | 'body' | 'feel';

export type MetricDef = {
  id: MetricId;
  label: string;
  unit: string;
  category: MetricCategory;
  /** How to combine days when bucketing into weeks/months for charts. */
  rollup: 'mean' | 'sum';
  /** Whether a higher value is generally a good thing; null when neither direction is better. */
  higherIsBetter: boolean | null;
  sources: Source[];
  decimals: number;
  format?: 'duration' | 'clock';
  chart: 'line' | 'bar';
  icon: string;
  /** Upper bound of the scale, e.g. 100 for scores and percentages, so charts never run past it. */
  max?: number;
  /** Lower bound of the scale for rating metrics. */
  min?: number;
  /** Stored for the app's own use (e.g. goals), not shown as a trend. */
  hidden?: boolean;
  /** Can be entered by hand from the metric screen. */
  manualEntry?: boolean;
};

const GARMIN_FIRST: Source[] = ['garmin', 'health_connect', 'import'];
const HC_FIRST: Source[] = ['health_connect', 'garmin', 'import'];
const MANUAL_FIRST: Source[] = ['manual', 'health_connect', 'garmin', 'import'];
const MANUAL: Source[] = ['manual'];

const RAW_METRICS: Omit<MetricDef, 'icon'>[] = [
  {id: 'steps', label: 'Steps', unit: '', category: 'activity', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'bar'},
  {id: 'distance_km', label: 'Distance', unit: 'km', category: 'activity', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 1, chart: 'bar'},
  {id: 'active_kcal', label: 'Active calories', unit: 'kcal', category: 'activity', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'bar'},
  {id: 'total_kcal', label: 'Total calories', unit: 'kcal', category: 'activity', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, chart: 'bar'},
  {id: 'floors', label: 'Floors climbed', unit: '', category: 'activity', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'bar'},
  {id: 'intensity_min', label: 'Intensity minutes', unit: 'min', category: 'activity', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'bar'},
  {id: 'exercise_min', label: 'Exercise', unit: 'min', category: 'activity', rollup: 'mean', higherIsBetter: true, sources: HC_FIRST, decimals: 0, chart: 'bar'},
  {id: 'resting_hr', label: 'Resting heart rate', unit: 'bpm', category: 'heart', rollup: 'mean', higherIsBetter: false, sources: GARMIN_FIRST, decimals: 0, chart: 'line'},
  {id: 'hr_avg', label: 'Average heart rate', unit: 'bpm', category: 'heart', rollup: 'mean', higherIsBetter: null, sources: HC_FIRST, decimals: 0, chart: 'line'},
  {id: 'hr_min', label: 'Lowest heart rate', unit: 'bpm', category: 'heart', rollup: 'mean', higherIsBetter: false, sources: HC_FIRST, decimals: 0, chart: 'line'},
  {id: 'hr_max', label: 'Highest heart rate', unit: 'bpm', category: 'heart', rollup: 'mean', higherIsBetter: null, sources: HC_FIRST, decimals: 0, chart: 'line'},
  {id: 'hrv_overnight', label: 'Overnight HRV', unit: 'ms', category: 'recovery', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'line'},
  {id: 'stress_avg', label: 'Average stress', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: false, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'stress_max', label: 'Peak stress', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: false, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'sleep_stress', label: 'Overnight stress', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: false, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'body_battery_high', label: 'Body Battery high', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'body_battery_low', label: 'Body Battery low', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'body_battery_wake', label: 'Body Battery at wake', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'body_battery_charged', label: 'Body Battery charged', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'bar', max: 100},
  {id: 'body_battery_drained', label: 'Body Battery drained', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, chart: 'bar', max: 100},
  {id: 'sleep_total_min', label: 'Total sleep', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'sleep_deep_min', label: 'Deep sleep', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'sleep_light_min', label: 'Light sleep', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'sleep_rem_min', label: 'REM sleep', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'sleep_awake_min', label: 'Awake time', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: false, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'sleep_efficiency', label: 'Sleep efficiency', unit: '%', category: 'sleep', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'sleep_start', label: 'Bedtime', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, format: 'clock', chart: 'line'},
  {id: 'sleep_end', label: 'Wake time', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, format: 'clock', chart: 'line'},
  {id: 'sleep_midpoint', label: 'Sleep midpoint', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, format: 'clock', chart: 'line'},
  {id: 'sleep_score', label: 'Sleep score', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: true, sources: ['import'], decimals: 0, chart: 'line', max: 100},
  {id: 'garmin_sleep_need', label: 'Garmin sleep need', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'line'},
  {id: 'nap_min', label: 'Naps', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'garmin_sleep_score', label: 'Garmin sleep score', unit: '', category: 'sleep', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'respiration_avg', label: 'Respiration', unit: 'brpm', category: 'heart', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 1, chart: 'line'},
  {id: 'respiration_sleep', label: 'Sleep respiration', unit: 'brpm', category: 'sleep', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 1, chart: 'line'},
  {id: 'spo2_avg', label: 'Pulse Ox', unit: '%', category: 'heart', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'spo2_low', label: 'Lowest Pulse Ox', unit: '%', category: 'heart', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'line', max: 100},
  {id: 'vo2max', label: 'VO2 max', unit: 'ml/kg/min', category: 'heart', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, chart: 'line'},
  {id: 'stress_rest_min', label: 'Rest time', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'stress_low_min', label: 'Low stress time', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'stress_medium_min', label: 'Medium stress time', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: false, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'stress_high_min', label: 'High stress time', unit: '', category: 'recovery', rollup: 'mean', higherIsBetter: false, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'sedentary_min', label: 'Sedentary time', unit: '', category: 'activity', rollup: 'mean', higherIsBetter: false, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'active_min', label: 'Active time', unit: '', category: 'activity', rollup: 'mean', higherIsBetter: true, sources: GARMIN_FIRST, decimals: 0, format: 'duration', chart: 'bar'},
  {id: 'garmin_step_goal', label: 'Garmin step goal', unit: '', category: 'activity', rollup: 'mean', higherIsBetter: null, sources: GARMIN_FIRST, decimals: 0, chart: 'line', hidden: true},
  {id: 'weight_kg', label: 'Weight', unit: 'kg', category: 'body', rollup: 'mean', higherIsBetter: null, sources: MANUAL_FIRST, decimals: 1, chart: 'line', manualEntry: true},
  {id: 'body_fat_pct', label: 'Body fat', unit: '%', category: 'body', rollup: 'mean', higherIsBetter: false, sources: MANUAL, decimals: 1, chart: 'line', max: 100, manualEntry: true},
  {id: 'bp_systolic', label: 'Blood pressure (systolic)', unit: 'mmHg', category: 'body', rollup: 'mean', higherIsBetter: false, sources: MANUAL, decimals: 0, chart: 'line', manualEntry: true},
  {id: 'bp_diastolic', label: 'Blood pressure (diastolic)', unit: 'mmHg', category: 'body', rollup: 'mean', higherIsBetter: false, sources: MANUAL, decimals: 0, chart: 'line', manualEntry: true},
  {id: 'checkin_energy', label: 'Energy', unit: '', category: 'feel', rollup: 'mean', higherIsBetter: true, sources: MANUAL, decimals: 1, chart: 'line', min: 1, max: 5},
  {id: 'checkin_mood', label: 'Mood', unit: '', category: 'feel', rollup: 'mean', higherIsBetter: true, sources: MANUAL, decimals: 1, chart: 'line', min: 1, max: 5},
  {id: 'checkin_soreness', label: 'Soreness', unit: '', category: 'feel', rollup: 'mean', higherIsBetter: false, sources: MANUAL, decimals: 1, chart: 'line', min: 1, max: 5},
];

const ICONS: Record<MetricId, string> = {
  steps: 'shoe-print',
  distance_km: 'map-marker-distance',
  active_kcal: 'fire',
  total_kcal: 'fire-circle',
  floors: 'stairs-up',
  intensity_min: 'lightning-bolt',
  exercise_min: 'run-fast',
  resting_hr: 'heart-pulse',
  hr_avg: 'heart-outline',
  hr_min: 'heart-minus-outline',
  hr_max: 'heart-plus-outline',
  hrv_overnight: 'sine-wave',
  stress_avg: 'head-alert-outline',
  stress_max: 'head-alert',
  sleep_stress: 'weather-night',
  body_battery_high: 'battery-high',
  body_battery_low: 'battery-low',
  body_battery_wake: 'battery-charging-medium',
  body_battery_charged: 'battery-plus-outline',
  body_battery_drained: 'battery-minus-outline',
  sleep_total_min: 'bed-clock',
  sleep_deep_min: 'moon-waning-crescent',
  sleep_light_min: 'weather-night-partly-cloudy',
  sleep_rem_min: 'eye-outline',
  sleep_awake_min: 'eye-check-outline',
  sleep_efficiency: 'percent-outline',
  sleep_start: 'bed',
  sleep_end: 'alarm',
  sleep_midpoint: 'clock-outline',
  sleep_score: 'star-circle-outline',
  garmin_sleep_score: 'star-outline',
  garmin_sleep_need: 'bed-clock',
  nap_min: 'sleep',
  respiration_avg: 'lungs',
  respiration_sleep: 'lungs',
  spo2_avg: 'water-percent',
  spo2_low: 'water-minus-outline',
  vo2max: 'run',
  weight_kg: 'scale-bathroom',
  body_fat_pct: 'percent-circle-outline',
  bp_systolic: 'gauge',
  bp_diastolic: 'gauge-low',
  stress_rest_min: 'sofa-outline',
  stress_low_min: 'emoticon-neutral-outline',
  stress_medium_min: 'emoticon-confused-outline',
  stress_high_min: 'emoticon-angry-outline',
  sedentary_min: 'seat-recline-normal',
  active_min: 'walk',
  garmin_step_goal: 'flag-checkered',
  checkin_energy: 'lightning-bolt-circle',
  checkin_mood: 'emoticon-happy-outline',
  checkin_soreness: 'arm-flex-outline',
};

export const METRICS: MetricDef[] = RAW_METRICS.map((m) => ({...m, icon: ICONS[m.id]}));

export const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m])) as Record<MetricId, MetricDef>;

export const CATEGORY_ICONS: Record<MetricCategory, string> = {
  activity: 'walk',
  heart: 'heart-pulse',
  sleep: 'power-sleep',
  recovery: 'battery-heart-variant',
  body: 'human',
  feel: 'emoticon-happy-outline',
};

export const CATEGORY_LABELS: Record<MetricCategory, string> = {
  activity: 'Activity',
  heart: 'Heart & breathing',
  sleep: 'Sleep',
  recovery: 'Recovery & stress',
  body: 'Body',
  feel: 'How you feel',
};
