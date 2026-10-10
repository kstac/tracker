import {kvGet} from '@/db/repo';
import {GarminClient} from '@/garmin/client';
import {addDays, today} from '@/lib/dates';

const NEED_FIELDS = ['baseline', 'actual', 'feedback', 'trainingFeedback', 'sleepHistoryAdjustment', 'hrvAdjustment', 'napAdjustment'];

function pick(obj: Record<string, unknown> | undefined) {
  if (!obj) return 'missing';
  return NEED_FIELDS.filter((k) => k in obj).map((k) => `${k}=${JSON.stringify(obj[k])}`).join(', ') || 'empty';
}

/** Shows the raw sleep need Garmin reports, to tell whether the watch adjusts it or only sends an age default. */
export async function sleepNeedReport(nights = 7): Promise<string> {
  const client = await GarminClient.fromStorage();
  if (!client) return 'Garmin is not connected.';
  const name = (await kvGet('garmin.display_name')) || (await client.displayName());
  const lines: string[] = [];
  for (let i = 0; i < nights; i++) {
    const date = addDays(today(), -i);
    const data = await client.get(`/wellness-service/wellness/dailySleepData/${name}`, {date, nonSleepBufferMinutes: 60});
    const dto = data?.dailySleepDTO;
    if (!dto) {
      lines.push(`${date}: no sleep data`);
      continue;
    }
    const naps = typeof dto.napTimeSeconds === 'number' ? `${Math.round(dto.napTimeSeconds / 60)} min` : 'none';
    lines.push(`${date}\n  sleepNeed: ${pick(dto.sleepNeed)}\n  nextSleepNeed: ${pick(dto.nextSleepNeed)}\n  naps: ${naps}`);
  }
  return lines.join('\n\n');
}
