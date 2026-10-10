import {addDays, formatMinutes, IsoDate, parseIsoDate} from '@/lib/dates';
import {windowValues} from '@/insights/baseline';
import {computeScoreHistory, ScoreHistoryDay, ScoreKind} from '@/insights/history';
import {mean, round, sd} from '@/insights/stats';
import {InsightInput} from '@/insights/types';
import {MetricId} from '@/metrics/types';

export type WeekStats = {
  from: IsoDate;
  to: IsoDate;
  readiness: number | null;
  sleepScore: number | null;
  activity: number | null;
  sleepMin: number | null;
  bedtimeSd: number | null;
  stepsPerDay: number | null;
  intensityMin: number | null;
  restingHr: number | null;
  stress: number | null;
  bestNight: {date: IsoDate; score: number} | null;
  worstNight: {date: IsoDate; score: number} | null;
};

export type WeeklySummary = {thisWeek: WeekStats; lastWeek: WeekStats; highlights: string[]};

const avgOf = (days: ScoreHistoryDay[], kind: ScoreKind) => {
  const m = mean(days.flatMap((d) => (d[kind] ? [d[kind]!.value] : [])));
  return m == null ? null : round(m, 1);
};

function weekStats(input: InsightInput, days: ScoreHistoryDay[], to: IsoDate): WeekStats {
  const vals = (metric: MetricId) => windowValues(input.daily[metric], to, 7);
  const avg = (metric: MetricId) => mean(vals(metric));
  const intensity = vals('intensity_min');
  const bedtimes = vals('sleep_start');
  const nights = days.flatMap((d) => (d.sleep ? [{date: d.date, score: d.sleep.value}] : []));
  const best = nights.reduce<{date: IsoDate; score: number} | null>((b, n) => (!b || n.score > b.score ? n : b), null);
  const worst = nights.reduce<{date: IsoDate; score: number} | null>((w, n) => (!w || n.score < w.score ? n : w), null);
  return {
    from: addDays(to, -6),
    to,
    readiness: avgOf(days, 'readiness'),
    sleepScore: avgOf(days, 'sleep'),
    activity: avgOf(days, 'activity'),
    sleepMin: avg('sleep_total_min'),
    bedtimeSd: bedtimes.length >= 3 ? sd(bedtimes) : null,
    stepsPerDay: avg('steps'),
    intensityMin: intensity.length ? intensity.reduce((a, b) => a + b, 0) : null,
    restingHr: avg('resting_hr'),
    stress: avg('stress_avg'),
    bestNight: best,
    worstNight: worst,
  };
}

type Highlight = {weight: number; text: string};

function highlights(a: WeekStats, b: WeekStats): string[] {
  const out: Highlight[] = [];
  const both = (x: number | null, y: number | null): x is number => x != null && y != null;

  if (both(a.sleepMin, b.sleepMin)) {
    const diff = a.sleepMin - b.sleepMin!;
    if (Math.abs(diff) >= 15) {
      out.push({weight: Math.abs(diff) / 15, text: `You slept ${formatMinutes(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} per night than last week (${formatMinutes(a.sleepMin)} average).`});
    }
  }
  if (both(a.readiness, b.readiness)) {
    const diff = a.readiness - b.readiness!;
    if (Math.abs(diff) >= 3) out.push({weight: Math.abs(diff) / 3, text: `Readiness averaged ${Math.round(a.readiness)}, ${Math.round(Math.abs(diff))} points ${diff > 0 ? 'higher' : 'lower'} than last week.`});
  }
  if (both(a.restingHr, b.restingHr)) {
    const diff = a.restingHr - b.restingHr!;
    if (Math.abs(diff) >= 2) out.push({weight: Math.abs(diff) / 2, text: `Resting heart rate ${diff > 0 ? 'rose' : 'dropped'} ${Math.round(Math.abs(diff))} bpm to ${Math.round(a.restingHr)} bpm.`});
  }
  if (both(a.bedtimeSd, b.bedtimeSd)) {
    const diff = a.bedtimeSd - b.bedtimeSd!;
    if (Math.abs(diff) >= 15) out.push({weight: Math.abs(diff) / 20, text: `Your bedtime was ${diff < 0 ? 'more' : 'less'} consistent, varying by about ${formatMinutes(a.bedtimeSd)}.`});
  }
  if (both(a.stepsPerDay, b.stepsPerDay) && b.stepsPerDay! > 0) {
    const pct = ((a.stepsPerDay - b.stepsPerDay!) / b.stepsPerDay!) * 100;
    if (Math.abs(pct) >= 15) out.push({weight: Math.abs(pct) / 15, text: `You walked ${Math.round(Math.abs(pct))}% ${pct > 0 ? 'more' : 'less'}, about ${Math.round(a.stepsPerDay).toLocaleString()} steps a day.`});
  }
  if (a.intensityMin != null) {
    const met = a.intensityMin >= 150;
    out.push({weight: met ? 1.2 : 0.8, text: met
      ? `You hit ${Math.round(a.intensityMin)} intensity minutes, above the 150-minute weekly target.`
      : `${Math.round(a.intensityMin)} of 150 intensity minutes this week.`});
  }
  if (both(a.stress, b.stress)) {
    const diff = a.stress - b.stress!;
    if (Math.abs(diff) >= 4) out.push({weight: Math.abs(diff) / 4, text: `Average stress was ${diff > 0 ? 'up' : 'down'} ${Math.round(Math.abs(diff))} points on last week.`});
  }
  if (a.bestNight && a.worstNight && a.bestNight.date !== a.worstNight.date) {
    const day = (d: IsoDate) => parseIsoDate(d).toLocaleDateString('en-AU', {weekday: 'long'});
    out.push({weight: 0.5, text: `Best night was ${day(a.bestNight.date)} (${Math.round(a.bestNight.score)}), worst was ${day(a.worstNight.date)} (${Math.round(a.worstNight.score)}).`});
  }
  return out.sort((x, y) => y.weight - x.weight).slice(0, 4).map((h) => h.text);
}

/** The 7 days ending on `weekEnd` compared with the 7 days before them. */
export function computeWeeklySummary(input: InsightInput, weekEnd: IsoDate): WeeklySummary {
  const from = addDays(weekEnd, -13);
  const lastEnd = addDays(weekEnd, -7);
  const {days} = computeScoreHistory(input, from, weekEnd);
  const last = days.filter((d) => d.date <= lastEnd);
  const cur = days.filter((d) => d.date > lastEnd);
  const thisWeek = weekStats(input, cur, weekEnd);
  const lastWeek = weekStats(input, last, lastEnd);
  return {thisWeek, lastWeek, highlights: highlights(thisWeek, lastWeek)};
}

