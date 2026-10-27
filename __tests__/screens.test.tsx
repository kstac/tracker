/**
 * Smoke tests: every screen renders with a realistic year of synthetic data without throwing.
 * Native modules, navigation and charts are stubbed; the insights engine runs for real.
 */
import {ReactElement} from 'react';
import {act, create, ReactTestRenderer} from 'react-test-renderer';
import {PaperProvider} from 'react-native-paper';
import {computeInsights, InsightInput} from '@/insights';
import {addDays, startOfDayTs} from '@/lib/dates';
import {Activity, DailyData, Experiment, SleepNight, Tag, TagEntry} from '@/metrics/types';
import {THEMES} from '@/theme';

const mockParams: {current: Record<string, string>} = {current: {}};

jest.mock('expo-router', () => {
  const Stack = Object.assign(() => null, {Screen: () => null});
  return {
    router: {push: jest.fn(), back: jest.fn(), setParams: jest.fn()},
    Stack,
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: () => {},
    Link: () => null,
  };
});
jest.mock('react-native-gifted-charts', () => ({BarChart: () => null, LineChart: () => null}));
jest.mock('expo-linear-gradient', () => ({LinearGradient: ({children}: {children: unknown}) => children}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-secure-store', () => ({getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {}}));
jest.mock('@/db/repo', () => ({
  getBodyBatteryEvents: async () => [],
  getSamples: async () => [],
  kvGet: async () => null,
  kvSet: async () => {},
  dumpDatabase: async () => ({}),
  getLegacyImportReport: async () => null,
  migrateLegacyTrackers: async () => null,
}));
jest.mock('@/db/backup', () => ({}));
jest.mock('@/lib/exportCsv', () => ({}));
jest.mock('@/lib/notifications', () => ({
  DEFAULT_PREFS: jest.requireActual('@/lib/notifications/decide').DEFAULT_PREFS,
  getPrefs: async () => jest.requireActual('@/lib/notifications/decide').DEFAULT_PREFS,
  permissionGranted: async () => false,
  requestPermission: async () => false,
  setPrefs: async () => {},
}));
jest.mock('@/garmin/auth', () => ({clearTokens: async () => {}, loadTokens: async () => null}));
jest.mock('@/garmin/diagnostics', () => ({sleepNeedReport: async () => ''}));
jest.mock('@/sync', () => ({resetHealthConnectSyncState: async () => {}}));
jest.mock('@/sync/garmin', () => ({resetGarminSyncState: async () => {}}));
jest.mock('@/sync/healthConnect', () => ({
  getHealthConnectStatus: async () => 'ready',
  hasHistoryPermission: async () => true,
  listExerciseSessions: async () => [],
  openHealthConnectSettings: () => {},
  requestHealthConnectPermissions: async () => 'ready',
}));
jest.mock('@/providers/ThemePreference', () => ({useThemePreference: () => ({preference: 'system', setPreference: () => {}})}));

const TODAY = '2026-10-27';
const DAYS = 400;
const wobble = (i: number, k: number) => Math.sin(i * 0.9 + k) + Math.sin(i * 0.37 + k * 2) * 0.5;

function synthetic(): InsightInput {
  const daily: DailyData = {};
  const put = (m: keyof DailyData, d: string, v: number) => (daily[m] ??= new Map()).set(d, v);
  const sleep: SleepNight[] = [];
  const tagEntries: TagEntry[] = [];
  const activities: Activity[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    const drank = i % 6 === 2;
    const drankYesterday = (i + 1) % 6 === 2;
    const worked = i % 3 === 0;
    put('steps', d, 8000 + wobble(i, 1) * 2500 + (worked ? 3000 : 0));
    put('active_kcal', d, 450 + wobble(i, 2) * 120);
    put('intensity_min', d, worked ? 45 : 8);
    put('resting_hr', d, 56 + wobble(i, 3) + (drankYesterday ? 3 : 0));
    put('hr_max', d, 150 + wobble(i, 4) * 10);
    put('stress_avg', d, 32 + wobble(i, 5) * 6);
    put('sleep_stress', d, 18 + wobble(i, 6) * 3 + (drankYesterday ? 6 : 0));
    put('body_battery_wake', d, 75 + wobble(i, 7) * 8 - (drankYesterday ? 12 : 0));
    put('body_battery_high', d, 85 + wobble(i, 8) * 6);
    put('body_battery_low', d, 20 + wobble(i, 9) * 6);
    put('respiration_sleep', d, 14 + wobble(i, 10) * 0.3);
    put('spo2_low', d, 92 + wobble(i, 11));
    put('stress_rest_min', d, 600);
    put('stress_low_min', d, 200);
    put('stress_medium_min', d, 90);
    put('stress_high_min', d, 20);
    put('garmin_sleep_score', d, 78 + wobble(i, 12) * 6);
    put('garmin_step_goal', d, 9000);
    if (i % 7 === 0) put('weight_kg', d, 78 - i * 0.004);
    if (i < 30) {
      put('checkin_energy', d, 3 + Math.round(wobble(i, 13)));
      put('checkin_mood', d, 4);
      put('checkin_soreness', d, 2);
    }
    const asleep = 440 + wobble(i, 14) * 30 - (drankYesterday ? 35 : 0);
    const bed = -60 + wobble(i, 15) * 25 + (drankYesterday ? 40 : 0);
    const start = startOfDayTs(d) + bed * 60_000;
    sleep.push({date: d, source: 'garmin', startTs: start, endTs: start + (asleep + 20) * 60_000, deepMin: asleep * 0.18, lightMin: asleep * 0.58, remMin: asleep * 0.24, awakeMin: 20});
    put('sleep_total_min', d, asleep);
    put('sleep_start', d, Math.round(bed));
    put('sleep_end', d, Math.round(bed + asleep + 20));
    put('sleep_midpoint', d, Math.round(bed + (asleep + 20) / 2));
    put('sleep_awake_min', d, 20);
    put('sleep_efficiency', d, 95);
    if (drank) tagEntries.push({tagId: 'alcohol', date: d, value: i % 12 === 2 ? 4 : 1, timeMin: 1200});
    if (i % 4 === 1) tagEntries.push({tagId: 'caffeine', date: d, value: 2, timeMin: 900});
    if (i % 5 === 0) tagEntries.push({tagId: 'meditation', date: d, value: 1});
    if (worked) {
      activities.push({
        id: `g${i}`, source: 'garmin', date: d, startTs: startOfDayTs(d) + 7 * 3_600_000, durationMin: 42, type: i % 2 ? 'running' : 'strength_training',
        name: null, avgHr: 142, maxHr: 168, kcal: 400, distanceKm: 6.5, aerobicTe: 3.1, anaerobicTe: 1.2, garminLoad: null, zoneMin: [2, 10, 20, 8, 2],
      });
    }
  }
  const tags: Tag[] = [
    {id: 'alcohol', name: 'Alcohol', createdAt: 0, unit: 'drinks', weeklyLimit: 7},
    {id: 'caffeine', name: 'Caffeine', createdAt: 1, unit: 'cups', weeklyLimit: null},
    {id: 'meditation', name: 'Meditation', createdAt: 2, unit: null, weeklyLimit: null},
    {id: 'old', name: 'Old tag', createdAt: 3, unit: null, weeklyLimit: null, archived: true},
  ];
  const experiments: Experiment[] = [
    {id: 'x', name: 'No alcohol', tagId: 'alcohol', mode: 'avoid', start: addDays(TODAY, -10), days: 14, prediction: 'better', metrics: ['sleep_score', 'readiness'], createdAt: 0, endedAt: null},
  ];
  return {
    today: TODAY, daily, sleep, tags: tags.filter((t) => !t.archived), tagEntries, activities, experiments,
    statuses: [{id: 's', kind: 'travel', start: addDays(TODAY, -40), end: addDays(TODAY, -35), note: null}],
    settings: {gradualBedtime: true}, now: new Date(2026, 9, 27, 8, 0),
    // Keep the archived tag visible to screens that list all tags.
    ...({allTags: tags} as object),
  };
}

const input = synthetic();
if (process.env.PROFILE) {
  const t = (label: string, fn: () => unknown) => {
    const s0 = Date.now();
    fn();
    console.log(label, Date.now() - s0, 'ms');
  };
  const I = jest.requireActual('@/insights');
  const H = jest.requireActual('@/insights/history');
  const E = jest.requireActual('@/insights/effects');
  t('history', () => H.computeScoreHistory(input, addDays(TODAY, -364), TODAY));
  const rep = I.computeInsights(input);
  t('effects', () => E.computeEffects({today: TODAY, daily: input.daily, sleepScores: rep.sleepScores, readiness: new Map(rep.history.days.filter((d: any) => d.readiness).map((d: any) => [d.date, d.readiness.value])), tags: input.tags, tagEntries: input.tagEntries, loads: new Map(rep.load.days.map((d: any) => [d.date, d.load])), activities: input.activities}));
  t('bodyCheck', () => I.computeBodyCheck(input.daily, TODAY, {}));
  t('load', () => I.computeLoad(input.daily, input.activities, TODAY));
  t('total', () => I.computeInsights(input));
}
const started = Date.now();
const report = computeInsights(input);
const computeMs = Date.now() - started;

const mockAppData = {
  loading: false,
  daily: {...input.daily, sleep_score: report.sleepScores},
  sleep: input.sleep,
  tags: input.tags,
  allTags: (input as unknown as {allTags: Tag[]}).allTags,
  tagEntries: input.tagEntries,
  activities: input.activities,
  statuses: input.statuses,
  experiments: input.experiments,
  notes: [{date: TODAY, text: 'Felt good'}],
  settings: input.settings,
  report,
  syncing: false,
  progress: null,
  lastSync: null,
};
jest.mock('@/providers/AppData', () => ({
  useAppData: () => new Proxy(mockAppData, {get: (t, k) => (k in t ? t[k as keyof typeof t] : async () => {})}),
}));

function render(el: ReactElement): ReactTestRenderer {
  let r: ReactTestRenderer;
  act(() => {
    r = create(<PaperProvider theme={THEMES.light}>{el}</PaperProvider>);
  });
  return r!;
}

function text(r: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (typeof n === 'string') out.push(n);
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object' && 'children' in n) walk((n as {children: unknown}).children);
  };
  walk(r.toJSON());
  return out.join(' ');
}

describe('screens render with a year of data', () => {
  it('computes the full report quickly enough for a phone', () => {
    expect(computeMs).toBeLessThan(1500);
    expect(report.readiness?.action).toBeDefined();
    expect(report.load.status).not.toBe('calibrating');
    expect(report.effects.effects.some((e) => e.factorId === 'alcohol' && e.confidence === 'strong')).toBe(true);
  });

  const screens: [string, () => ReactElement, Record<string, string>?, string?][] = [
    ['Today', () => {
      const S = require('@/app/(tabs)/index').default;
      return <S />;
    }, {}, 'Readiness'],
    ['Trends', () => {
      const S = require('@/app/(tabs)/trends').default;
      return <S />;
    }, {}, 'This week'],
    ['Insights', () => {
      const S = require('@/app/(tabs)/insights').default;
      return <S />;
    }, {}, 'What helps you'],
    ['Journal', () => {
      const S = require('@/app/(tabs)/tags').default;
      return <S />;
    }, {}, 'Alcohol'],
    ['Settings', () => {
      const S = require('@/app/(tabs)/settings').default;
      return <S />;
    }, {}, 'Sleep need'],
    ['Tag', () => {
      const S = require('@/app/tag/[id]').default;
      return <S />;
    }, {id: 'alcohol'}, 'How it affects you'],
    ['Factor', () => {
      const S = require('@/app/factor/[id]').default;
      return <S />;
    }, {id: 'workout'}, 'How it affects you'],
    ['Training', () => {
      const S = require('@/app/training').default;
      return <S />;
    }, {}, 'Workouts'],
    ['Body', () => {
      const S = require('@/app/body').default;
      return <S />;
    }, {}, 'Strain radar'],
    ['Report', () => {
      const S = require('@/app/report/[month]').default;
      return <S />;
    }, {month: '2026-09-01'}, 'Highlights'],
    ['New experiment', () => {
      const S = require('@/app/experiment/new').default;
      return <S />;
    }, {}, 'Your prediction'],
    ['Experiment', () => {
      const S = require('@/app/experiment/[id]').default;
      return <S />;
    }, {id: 'x'}, 'Results'],
    ['Metric', () => {
      const S = require('@/app/metric/[id]').default;
      return <S />;
    }, {id: 'weight_kg'}, 'Add a reading'],
    ['Score history', () => {
      const S = require('@/app/scores/[kind]').default;
      return <S />;
    }, {kind: 'readiness'}, 'Days scored'],
    ['Ask', () => {
      const S = require('@/app/ask').default;
      return <S />;
    }, {}, ''],
  ];

  it.each(screens)('%s', (_name, make, params = {}, expected = '') => {
    mockParams.current = params;
    const r = render(make());
    if (expected) expect(text(r)).toContain(expected);
    if (process.env.DUMP_SCREENS) require('fs').writeFileSync(`/tmp/screen-${_name.replace(/ /g, '_')}.txt`, `${computeMs}ms\n` + text(r));
    act(() => r.unmount());
  });
});
