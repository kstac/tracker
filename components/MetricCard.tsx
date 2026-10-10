import {View} from 'react-native';
import {router} from 'expo-router';
import {Text} from 'react-native-paper';
import {LineChart} from 'react-native-gifted-charts';
import DeltaPill from '@/components/ui/DeltaPill';
import IconBadge from '@/components/ui/IconBadge';
import {Panel} from '@/components/ui/Panel';
import {addDays, today} from '@/lib/dates';
import {formatMetricValue} from '@/lib/format';
import {seriesFor, windowAverage} from '@/lib/series';
import {MetricDef} from '@/metrics/registry';
import {DailyData} from '@/metrics/types';
import {useAppTheme} from '@/theme';

const SPARK_WIDTH = 96;

export default function MetricCard({def, daily}: {def: MetricDef; daily: DailyData}) {
  const {chart} = useAppTheme();
  const color = chart.category[def.category];
  const end = today();
  const avg7 = windowAverage(daily, def.id, end, 7);
  const avg30 = windowAverage(daily, def.id, end, 30);
  const avg90 = windowAverage(daily, def.id, end, 90);
  const prev30 = windowAverage(daily, def.id, addDays(end, -30), 30);
  const spark = seriesFor(daily, def.id, addDays(end, -29), end);
  const delta = avg30 != null && prev30 != null ? avg30 - prev30 : null;
  const lo = spark.length ? Math.min(...spark.map((p) => p.value)) : 0;

  return (
    <Panel onPress={() => router.push({pathname: '/metric/[id]', params: {id: def.id}})}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
        <IconBadge icon={def.icon} color={color} size={32} />
        <Text variant="titleSmall" style={{color: chart.inkPrimary, fontWeight: '600', flex: 1}}>{def.label}</Text>
        {delta != null && <DeltaPill def={def} delta={delta} />}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10}}>
        <View>
          <Text variant="headlineSmall" style={{color: chart.inkPrimary, fontWeight: '700'}}>{formatMetricValue(def, avg7)}</Text>
          <Text variant="labelSmall" style={{color: chart.inkMuted}}>7-day average</Text>
        </View>
        {spark.length > 1 && (
          <View pointerEvents="none" style={{width: SPARK_WIDTH, height: 44, overflow: 'hidden'}}>
            <LineChart
              data={spark.map((p) => ({value: p.value - lo + 1}))}
              height={40}
              width={SPARK_WIDTH}
              spacing={SPARK_WIDTH / spark.length}
              initialSpacing={0}
              endSpacing={0}
              thickness={2}
              color={color}
              curved
              curvature={0.15}
              areaChart
              startFillColor={color}
              endFillColor={color}
              startOpacity={0.25}
              endOpacity={0}
              hideDataPoints
              hideRules
              hideYAxisText
              hideAxesAndRules
              yAxisLabelWidth={0}
              disableScroll
            />
          </View>
        )}
      </View>
      <View style={{flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: chart.grid}}>
        <Text variant="bodySmall" style={{color: chart.inkSecondary}}>30d <Text style={{color: chart.inkPrimary, fontWeight: '600'}}>{formatMetricValue(def, avg30)}</Text></Text>
        <Text variant="bodySmall" style={{color: chart.inkSecondary}}>90d <Text style={{color: chart.inkPrimary, fontWeight: '600'}}>{formatMetricValue(def, avg90)}</Text></Text>
        {delta != null && <Text variant="bodySmall" style={{color: chart.inkMuted}}>change vs prior 30d</Text>}
      </View>
    </Panel>
  );
}
