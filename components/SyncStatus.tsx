import {View} from 'react-native';
import {ProgressBar, Text} from 'react-native-paper';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

function ago(ts: number) {
  const min = Math.round((Date.now() - ts) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export default function SyncStatus() {
  const {chart} = useAppTheme();
  const {syncing, progress, lastSync} = useAppData();
  if (syncing) {
    return (
      <View style={{paddingHorizontal: 16, paddingBottom: 8}}>
        <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{progress?.message ?? 'Syncing…'}</Text>
        <ProgressBar indeterminate={progress?.fraction == null} progress={progress?.fraction ?? 0} style={{marginTop: 4}} />
      </View>
    );
  }
  if (!lastSync) return null;
  const errors = [lastSync.healthConnect, lastSync.garmin].filter((o) => o.status === 'error');
  return (
    <Text variant="bodySmall" style={{color: errors.length ? chart.status.critical : chart.inkMuted, paddingHorizontal: 16, paddingBottom: 8}}>
      {errors.length ? `Sync problem — see Settings · ` : ''}Synced {ago(lastSync.at)}
    </Text>
  );
}
