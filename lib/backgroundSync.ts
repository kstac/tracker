import {Platform} from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import {runNotificationChecks} from '@/lib/notifications';
import {runSync} from '@/sync';

const TASK = 'health-background-sync';
const INTERVAL_MINUTES = 60;

if (Platform.OS !== 'web') {
  TaskManager.defineTask(TASK, async () => {
    try {
      await runSync();
      await runNotificationChecks({foreground: false});
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundSync() {
  if (Platform.OS === 'web') return;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(TASK)) return;
  await BackgroundTask.registerTaskAsync(TASK, {minimumInterval: INTERVAL_MINUTES});
}
