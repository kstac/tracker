import {bedtimeReminder, DecideContext, decideNotifications, DEFAULT_PREFS} from '@/lib/notifications/decide';
import {InsightReport} from '@/insights';

const at = (h: number, m = 0, day = 10) => new Date(2026, 9, day, h, m);

const report = {
  date: '2026-10-10',
  readiness: {
    value: 78, label: 'Good', calibrating: false, date: '2026-10-10',
    contributors: [
      {key: 'rhr', label: 'Resting heart rate', score: 90, detail: '45 bpm, in line with usual'},
      {key: 'sleep_balance', label: 'Sleep balance', score: 55, detail: '6h 40m average over 14 days'},
    ],
  },
  sleep: {value: 84, label: 'Good', calibrating: false, date: '2026-10-10', contributors: []},
  activity: null,
  sleepScores: new Map(),
  insights: [{id: 'strain_radar', kind: 'warning', title: 'Signs of strain', body: 'Resting HR and stress are up', priority: 100}],
} as unknown as InsightReport;

const ctx = (over: Partial<DecideContext> = {}): DecideContext => ({
  now: at(8),
  prefs: DEFAULT_PREFS,
  sent: {},
  report,
  lastWakeTs: at(7, 15).getTime(),
  garminAuthBroken: false,
  weeklyBody: null,
  ...over,
});

describe('decideNotifications', () => {
  it('sends the morning readiness with the weakest contributor, plus a strain alert', () => {
    expect(decideNotifications(ctx())).toEqual([
      {type: 'readiness', title: 'Readiness 78 · Good · Sleep 84', body: 'Sleep balance: 6h 40m average over 14 days'},
      {type: 'strain', title: 'Signs of strain', body: 'Resting HR and stress are up'},
    ]);
  });

  it('waits until shortly after waking, skips late mornings, and never repeats on the same day', () => {
    expect(decideNotifications(ctx({now: at(7, 25)})).map((n) => n.type)).toEqual(['strain']);
    expect(decideNotifications(ctx({now: at(14)})).map((n) => n.type)).toEqual(['strain']);
    expect(decideNotifications(ctx({sent: {readiness: '2026-10-10', strain: '2026-10-10'}}))).toEqual([]);
    expect(decideNotifications(ctx({lastWakeTs: at(7, 15, 9).getTime()})).map((n) => n.type)).toEqual(['strain']);
  });

  it('respects disabled types', () => {
    expect(decideNotifications(ctx({prefs: {...DEFAULT_PREFS, readiness: false, strain: false}}))).toEqual([]);
  });

  it('sends the weekly review on Monday morning and sync problems once a day', () => {
    const monday = new Date(2026, 9, 12, 9);
    expect(
      decideNotifications(ctx({now: monday, report: null, lastWakeTs: null, weeklyBody: 'Sleep up 20 min', garminAuthBroken: true})),
    ).toEqual([
      {type: 'weekly', title: 'Last week in review', body: 'Sleep up 20 min'},
      {type: 'sync_problem', title: 'Garmin needs you to sign in again', body: 'Body Battery, stress and sleep score have stopped syncing. Open Settings to sign in.'},
    ]);
  });

  it('uses the readiness action, adds the training target, and skips softened strain notes', () => {
    const withAction = {
      ...report,
      readiness: {...report.readiness!, action: 'ready'},
      load: {target: {low: 20, high: 45, reason: ''}},
      insights: [{...report.insights[0], kind: 'info'}],
    } as unknown as InsightReport;
    expect(decideNotifications(ctx({report: withAction}))).toEqual([
      {type: 'readiness', title: 'Readiness 78 · Ready · Sleep 84', body: 'Sleep balance: 6h 40m average over 14 days · Training target today 20–45'},
    ]);
  });

  it('schedules the bedtime nudge an hour before tonight\'s target', () => {
    const plan = {
      wakeDate: '2026-10-11', bedtime: -75, stepBedtime: null, wakeTarget: 420,
      need: {tonightMin: 480, debtRepayMin: 15},
    };
    const evening = {...report, sleepPlan: plan} as unknown as InsightReport;
    expect(bedtimeReminder(evening, at(20, 0))).toEqual({
      at: at(21, 45),
      title: 'Wind down: aim to be asleep by 22:45',
      body: 'That gives you 8h 00m of sleep before 07:00, including 15m to pay back sleep debt.',
    });
    expect(bedtimeReminder(evening, at(22, 0))).toBeNull();
  });

  it('sends the monthly review on the 1st', () => {
    const first = new Date(2026, 10, 1, 10);
    expect(decideNotifications(ctx({now: first, report: null, lastWakeTs: null, monthlyBody: 'Slept more'}))).toEqual([
      {type: 'monthly', title: 'Your month in review', body: 'Slept more'},
    ]);
  });
});
