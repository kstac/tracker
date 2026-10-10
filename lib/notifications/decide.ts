import {InsightReport} from '@/insights';
import {IsoDate, toIsoDate} from '@/lib/dates';

export type NotificationType = 'readiness' | 'evening_tags' | 'strain' | 'weekly' | 'sync_problem';

export type NotificationPrefs = {
  readiness: boolean;
  eveningTags: boolean;
  eveningTagsTime: {hour: number; minute: number};
  strain: boolean;
  weekly: boolean;
  syncProblem: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  readiness: true,
  eveningTags: false,
  eveningTagsTime: {hour: 21, minute: 0},
  strain: true,
  weekly: true,
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
};

const MIN_AFTER_WAKE_MS = 20 * 60_000;
const READINESS_LATEST_HOUR = 13;
const WEEKLY_DAY = 1;
const WEEKLY_HOUR = 8;

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
    const weakest = [...readiness.contributors].sort((a, b) => a.score - b.score)[0];
    const sleep = report?.sleep ? ` · Sleep ${report.sleep.value}` : '';
    out.push({
      type: 'readiness',
      title: `Readiness ${readiness.value} · ${readiness.calibrating ? 'Calibrating' : readiness.label}${sleep}`,
      body: weakest ? `${weakest.label}: ${weakest.detail}` : 'Open the app for details',
    });
  }

  const strain = report?.insights.find((i) => i.id === 'strain_radar');
  if (prefs.strain && strain && notSentToday('strain')) {
    out.push({type: 'strain', title: strain.title, body: strain.body});
  }

  if (prefs.weekly && ctx.weeklyBody && now.getDay() === WEEKLY_DAY && now.getHours() >= WEEKLY_HOUR && notSentToday('weekly')) {
    out.push({type: 'weekly', title: 'Last week in review', body: ctx.weeklyBody});
  }

  if (prefs.syncProblem && ctx.garminAuthBroken && notSentToday('sync_problem')) {
    out.push({type: 'sync_problem', title: 'Garmin needs you to sign in again', body: 'Body Battery, stress and sleep score have stopped syncing. Open Settings to sign in.'});
  }

  return out;
}
