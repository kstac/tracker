import * as repo from '@/db/repo';
import {InsightInput} from '@/insights/types';
import {today} from '@/lib/dates';
import {getSettings} from '@/lib/settings';

/** Everything the insights engine reads, straight from the database (used by background checks). */
export async function loadInsightInput(): Promise<InsightInput> {
  const [daily, sleep, tags, tagEntries, activities, statuses, experiments, settings] = await Promise.all([
    repo.loadDailyData(),
    repo.getSleepNights(),
    repo.listTags(),
    repo.getTagEntries(),
    repo.getActivities(),
    repo.getStatusPeriods(),
    repo.getExperiments(),
    getSettings(),
  ]);
  return {today: today(), daily, sleep, tags, tagEntries, activities, statuses, experiments, settings};
}
