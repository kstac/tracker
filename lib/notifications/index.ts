import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as repo from '@/db/repo';
import {computeInsights, lastCompletedWeek} from '@/insights';
import {today} from '@/lib/dates';
import {DEFAULT_PREFS, decideNotifications, NotificationPrefs, NotificationType} from '@/lib/notifications/decide';
import {lastSyncReport} from '@/sync';

export {DEFAULT_PREFS} from '@/lib/notifications/decide';
export type {NotificationPrefs} from '@/lib/notifications/decide';

const PREFS_KEY = 'notifications.prefs';
const SENT_KEY = 'notifications.sent';
const EVENING_ID = 'evening-tags';
const CHANNELS = {insights: 'insights', reminders: 'reminders'};

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false}),
  });
}

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNELS.insights, {name: 'Health insights', importance: Notifications.AndroidImportance.DEFAULT});
  await Notifications.setNotificationChannelAsync(CHANNELS.reminders, {name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT});
}

export async function getPrefs(): Promise<NotificationPrefs> {
  const raw = await repo.kvGet(PREFS_KEY);
  return raw ? {...DEFAULT_PREFS, ...JSON.parse(raw)} : DEFAULT_PREFS;
}

export async function setPrefs(prefs: NotificationPrefs) {
  await repo.kvSet(PREFS_KEY, JSON.stringify(prefs));
  await applySchedules(prefs);
}

export async function permissionGranted(): Promise<boolean> {
  if (!supported) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function requestPermission(): Promise<boolean> {
  if (!supported) return false;
  await ensureChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function applySchedules(prefs?: NotificationPrefs) {
  if (!supported) return;
  const p = prefs ?? (await getPrefs());
  await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => {});
  if (!p.eveningTags || !(await permissionGranted())) return;
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_ID,
    content: {title: 'Log today’s tags', body: 'A few taps now makes the patterns in your sleep and recovery much clearer.'},
    trigger: {type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: p.eveningTagsTime.hour, minute: p.eveningTagsTime.minute, channelId: CHANNELS.reminders},
  });
}

/**
 * Sends any notifications that are due. In the foreground nothing is shown, but due items are marked as seen
 * so the user isn't told about something they're already looking at.
 */
export async function runNotificationChecks({foreground}: {foreground: boolean}) {
  if (!supported) return;
  const prefs = await getPrefs();
  const [daily, sleep, tags, tagEntries, report, sentRaw] = await Promise.all([
    repo.loadDailyData(),
    repo.getSleepNights(),
    repo.listTags(),
    repo.getTagEntries(),
    lastSyncReport(),
    repo.kvGet(SENT_KEY),
  ]);
  const input = {today: today(), daily, sleep, tags, tagEntries};
  const insights = computeInsights(input);
  const sent: Partial<Record<NotificationType, string>> = sentRaw ? JSON.parse(sentRaw) : {};
  const notices = decideNotifications({
    now: new Date(),
    prefs,
    sent,
    report: insights,
    lastWakeTs: sleep.length ? sleep[sleep.length - 1].endTs : null,
    garminAuthBroken: report?.garmin.status === 'error' && !!report.garmin.authBroken,
    weeklyBody: lastCompletedWeek(input, input.today).highlights.slice(0, 2).join(' ') || null,
  });
  if (!notices.length) return;

  if (!foreground && (await permissionGranted())) {
    await ensureChannels();
    for (const n of notices) {
      await Notifications.scheduleNotificationAsync({
        content: {title: n.title, body: n.body},
        trigger: Platform.OS === 'android' ? {channelId: CHANNELS.insights} : null,
      });
    }
  }
  for (const n of notices) sent[n.type] = today();
  await repo.kvSet(SENT_KEY, JSON.stringify(sent));
}
