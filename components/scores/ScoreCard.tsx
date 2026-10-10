import {View} from 'react-native';
import {router} from 'expo-router';
import {Text} from 'react-native-paper';
import {LineChart} from 'react-native-gifted-charts';
import {SCORE_DEFS} from '@/components/scores/defs';
import DeltaPill from '@/components/ui/DeltaPill';
import IconBadge from '@/components/ui/IconBadge';
import {Panel} from '@/components/ui/Panel';
import {ScoreHistoryDay, ScoreKind} from '@/insights';
import {addDays, today} from '@/lib/dates';
import {useAppTheme} from '@/theme';

const SPARK_WIDTH = 96;

function avg(days: ScoreHistoryDay[], kind: ScoreKind): number | null {
  const values = days.flatMap((d) => (d[kind] ? [d[kind]!.value] : []));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export default function ScoreCard({kind, days}: {kind: ScoreKind; days: ScoreHistoryDay[]}) {
  const {chart} = useAppTheme();
  const def = SCORE_DEFS[kind];
  const color = chart.category[def.category];
  const end = today();
  const week = days.filter((d) => d.date > addDays(end, -7));
  const prevWeek = days.filter((d) => d.date <= addDays(end, -7) && d.date > addDays(end, -14));
  const cur = avg(week, kind);
  const prev = avg(prevWeek, kind);
  const spark = days.filter((d) => d.date > addDays(end, -30) && d[kind]).map((d) => d[kind]!.value);
  const lo = spark.length ? Math.min(...spark) : 0;

  return (
    <Panel onPress={() => router.push({pathname: '/scores/[kind]', params: {kind}})}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
        <IconBadge icon={def.icon} color={color} size={32} />
        <Text variant="titleSmall" style={{color: chart.inkPrimary, fontWeight: '600', flex: 1}}>{def.label}</Text>
        {cur != null && prev != null && <DeltaPill def={def} delta={cur - prev} suffix="vs last week" />}
      </View>
      <View style={{flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10}}>
        <View>
          <Text variant="headlineSmall" style={{color: chart.inkPrimary, fontWeight: '700'}}>{cur == null ? '–' : Math.round(cur)}</Text>
          <Text variant="labelSmall" style={{color: chart.inkMuted}}>7-day average</Text>
        </View>
        {spark.length > 1 && (
          <View pointerEvents="none" style={{width: SPARK_WIDTH, height: 44, overflow: 'hidden'}}>
            <LineChart
              data={spark.map((v) => ({value: v - lo + 1}))}
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
    </Panel>
  );
}
