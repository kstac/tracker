import {View} from 'react-native';
import {router} from 'expo-router';
import {Text} from 'react-native-paper';
import IconBadge from '@/components/ui/IconBadge';
import {Panel} from '@/components/ui/Panel';
import {ExperimentResult} from '@/insights';
import {parseIsoDate} from '@/lib/dates';
import {useAppTheme} from '@/theme';

const fmt = (d: string) => parseIsoDate(d).toLocaleDateString(undefined, {day: 'numeric', month: 'short'});

export default function ExperimentSummary({result}: {result: ExperimentResult}) {
  const {chart} = useAppTheme();
  const {experiment: e, state} = result;
  const progress = state === 'upcoming' ? `Starts ${fmt(e.start)}` : state === 'running' ? `Day ${result.daysElapsed} of ${e.days}` : `Finished ${fmt(result.end)}`;
  const color = state === 'running' ? chart.series[0] : result.metrics[0]?.improved ? chart.status.good : chart.inkMuted;
  return (
    <Panel onPress={() => router.push({pathname: '/experiment/[id]', params: {id: e.id}})} style={{flexDirection: 'row', gap: 12}}>
      <IconBadge icon={state === 'done' ? 'flask-outline' : 'flask'} color={color} />
      <View style={{flex: 1, gap: 2}}>
        <Text variant="titleSmall" style={{color: chart.inkPrimary, fontWeight: '600'}}>{e.name}</Text>
        <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
          {progress}
          {result.compliance ? ` · kept to it on ${result.compliance.kept} of ${result.compliance.logged} days` : ''}
        </Text>
        {result.verdict && <Text variant="bodySmall" style={{color: chart.inkPrimary}}>{result.verdict}</Text>}
      </View>
    </Panel>
  );
}

