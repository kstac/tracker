import {View} from 'react-native';
import {router} from 'expo-router';
import {Text} from 'react-native-paper';
import IconBadge from '@/components/ui/IconBadge';
import {Panel} from '@/components/ui/Panel';
import {Insight} from '@/insights';
import {useAppTheme} from '@/theme';

const ICONS = {warning: 'alert-circle-outline', positive: 'check-decagram-outline', info: 'lightbulb-on-outline'} as const;

export default function InsightCard({insight}: {insight: Insight}) {
  const {chart, colors} = useAppTheme();
  const color = insight.kind === 'warning' ? chart.status.serious : insight.kind === 'positive' ? chart.status.good : colors.primary;
  return (
    <Panel
      onPress={insight.metric ? () => router.push({pathname: '/metric/[id]', params: {id: insight.metric!}}) : undefined}
      style={{borderLeftWidth: 4, borderLeftColor: color, flexDirection: 'row', gap: 12}}
    >
      <IconBadge icon={ICONS[insight.kind]} color={color} />
      <View style={{flex: 1}}>
        <Text variant="titleSmall" style={{color: chart.inkPrimary, fontWeight: '600'}}>{insight.title}</Text>
        <Text variant="bodyMedium" style={{color: chart.inkSecondary, marginTop: 2}}>{insight.body}</Text>
      </View>
    </Panel>
  );
}
