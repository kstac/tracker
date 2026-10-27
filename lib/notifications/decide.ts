import {ACTION_TEXT, InsightReport, topDrags} from '@/insights';
import {formatClock, formatMinutes, IsoDate, toIsoDate} from '@/lib/dates';

export type NotificationType = 'readiness' | 'evening_tags' | 'strain' | 'weekly' | 'monthly' | 'bedtime' | 'sync_problem';

export type NotificationPrefs = {
  readiness: boolean;
  eveningTags: boolean;
  eveningTagsTime: {hour: number; minute: number};
  strain: boolean;
  weekly: boolean;
  monthly: boolean;
  bedtime: boolean;
  syncProblem: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  readiness: true,
  eveningTags: false,
  eveningTagsTime: {hour: 21, minute: 0},
  strain: true,
  weekly: true,
  monthly: true,
  bedtime: true,
  syncProblem: true,
};

export type Notice = {type: NotificationType; title: string; body: string};

export type DecideContext = {
  now: Date;
  prefs: NotificationPrefs;
  /** Last date each type was sent (or marked seen while the app was open). */
  sent: Partial<Record<NotificationType, IsoDate>>;
  report: InsightReport | null;
  lastWakeTs: number | null;
  garminAuthBroken: boolean;
  weeklyBody: string | null;
  monthlyBody?: string | null;
};

const MIN_AFTER_WAKE_MS = 20 * 60_000;
const READINESS_LATEST_HOUR = 13;
const WEEKLY_DAY = 1;
const WEEKLY_HOUR = 8;
const MONTHLY_HOUR = 9;
const BEDTIME_LEAD_MIN = 60;

function morningBody(report: InsightReport): string {
  const readiness = report.readiness!;
  const weakest = topDrags(readiness, 1, 0.5)[0] ?? [...readiness.contributors].sort((a, b) => a.score - b.score)[0];
  const parts = [weakest ? `${weakest.label}: ${weakest.detail}` : 'Open the app for details'];
  const target = report.load?.target;
  if (target) parts.push(`Training target today ${target.low}–${target.high}`);
  return parts.join(' · ');
}

export function decideNotifications(ctx: DecideContext): Notice[] {
  const {now, prefs, sent, report} = ctx;
  const date = toIsoDate(now);
  const notSentToday = (t: NotificationType) => sent[t] !== date;
  const out: Notice[] = [];

  const readiness = report?.readiness;
  if (
    prefs.readiness && readiness && notSentToday('readiness') &&
    ctx.lastWakeTs != null && toIsoDate(new Date(ctx.lastWakeTs)) === date &&
    now.getTime() - ctx.lastWakeTs >= MIN_AFTER_WAKE_MS && now.getHours() < READINESS_LATEST_HOUR
  ) {
    const label = readiness.calibrating ? 'Calibrating' : readiness.action ? ACTION_TEXT[readiness.action].label : readiness.label;
    const sleep = report?.sleep ? ` · Sleep ${report.sleep.value}` : '';
    out.push({type: 'readiness', title: `Readiness ${readiness.value} · ${label}${sleep}`, body: morningBody(report!)});
  }

  const strain = report?.insights.find((i) => i.id === 'strain_radar');
  if (prefs.strain && strain && strain.kind === 'warning' && notSentToday('strain')) {
    out.push({type: 'strain', title: strain.title, body: strain.body});
  }

  if (prefs.weekly && ctx.weeklyBody && now.getDay() === WEEKLY_DAY && now.getHours() >= WEEKLY_HOUR && notSentToday('weekly')) {
    out.push({type: 'weekly', title: 'Last week in review', body: ctx.weeklyBody});
  }

  if (prefs.monthly && ctx.monthlyBody && now.getDate() === 1 && now.getHours() >= MONTHLY_HOUR && notSentToday('monthly')) {
    out.push({type: 'monthly', title: 'Your month in review', body: ctx.monthlyBody});
  }

  if (prefs.syncProblem && ctx.garminAuthBroken && notSentToday('sync_problem')) {
    out.push({type: 'sync_problem', title: 'Garmin needs you to sign in again', body: 'Body Battery, stress and sleep score have stopped syncing. Open Settings to sign in.'});
  }

  return out;
}

export type ScheduledNotice = {at: Date; title: string; body: string};

/**
 * Tonight's wind-down nudge, an hour before the bedtime target. It's scheduled ahead as a local notification rather
 * than checked for, because background checks run too rarely to hit a short evening window reliably.
 */
export function bedtimeReminder(report: InsightReport | null, now: Date): ScheduledNotice | null {
  const plan = report?.sleepPlan;
  if (!plan) return null;
  const target = plan.stepBedtime ?? plan.bedtime;
  const [y, m, d] = plan.wakeDate.split('-').map(Number);
  const at = new Date(y, m - 1, d, 0, target - BEDTIME_LEAD_MIN);
  if (at.getTime() <= now.getTime()) return null;
  const debt = plan.need.debtRepayMin ? `, including ${formatMinutes(plan.need.debtRepayMin)} to pay back sleep debt` : '';
  return {
    at,
    title: `Wind down: aim to be asleep by ${formatClock(target)}`,
    body: `That gives you ${formatMinutes(plan.need.tonightMin)} of sleep before ${formatClock(plan.wakeTarget)}${debt}.`,
  };
}
