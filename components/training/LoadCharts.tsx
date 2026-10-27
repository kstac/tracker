import {useState} from 'react';
import {View} from 'react-native';
import {BarChart, LineChart} from 'react-native-gifted-charts';
import {Text} from 'react-native-paper';
import {useChartWidth} from '@/components/charts/useChartWidth';
import {LoadDay, LoadTarget} from '@/insights';
import {parseIsoDate} from '@/lib/dates';
import {useAppTheme} from '@/theme';

const Y = 36;
const label = (d: string) => parseIsoDate(d).toLocaleDateString(undefined, {day: 'numeric', month: 'short'});

export function DailyLoadChart({days, target, height = 160}: {days: LoadDay[]; target?: LoadTarget | null; height?: number}) {
  const {chart} = useAppTheme();
  const {onLayout, width, ready} = useChartWidth(Y);
  const [selected, setSelected] = useState<number | null>(null);
  if (!ready) return <View onLayout={onLayout} style={{height: height + 40}} />;
  if (!days.length) return <Text style={{color: chart.inkMuted}}>No training data yet</Text>;
  const slot = width / days.length;
  const barWidth = Math.max(2, slot * 0.7);
  const max = Math.max(...days.map((d) => d.load), target?.high ?? 0, 10);
  const step = Math.ceil((max * 1.1) / 4 / 5) * 5;
  const every = Math.ceil(days.length / 5);
  const sel = selected != null ? days[selected] : null;
  return (
    <View onLayout={onLayout} style={{overflow: 'hidden'}}>
      <Text variant="bodySmall" style={{color: sel ? chart.inkSecondary : chart.inkMuted, marginBottom: 4}}>
        {sel ? `${label(sel.date)} · load ${Math.round(sel.load)}` : 'Tap a bar for the day’s load'}
      </Text>
      <BarChart
        data={days.map((d, i) => ({
          value: d.load,
          label: i % every === 0 ? label(d.date) : '',
          frontColor: selected === i ? chart.inkPrimary : chart.category.activity,
          onPress: () => setSelected(i),
        }))}
        height={height}
        width={width}
        barWidth={barWidth}
        spacing={slot - barWidth}
        initialSpacing={(slot - barWidth) / 2}
        endSpacing={0}
        maxValue={step * 4}
        stepValue={step}
        noOfSections={4}
        yAxisTextStyle={{color: chart.inkMuted, fontSize: 10}}
        xAxisLabelTextStyle={{color: chart.inkMuted, fontSize: 10, width: 48}}
        rulesColor={chart.grid}
        rulesType="solid"
        xAxisColor={chart.axis}
        yAxisColor="transparent"
        yAxisLabelWidth={Y}
        disableScroll
      />
    </View>
  );
}

/** Fitness (42-day average load) against fatigue (7-day): fatigue above fitness means you're building, or overdoing it. */
export function FitnessChart({days, height = 160}: {days: LoadDay[]; height?: number}) {
  const {chart} = useAppTheme();
  const {onLayout, width, ready} = useChartWidth(Y);
  if (!ready) return <View onLayout={onLayout} style={{height: height + 40}} />;
  if (days.length < 2) return <Text style={{color: chart.inkMuted}}>Not enough data yet</Text>;
  const max = Math.max(...days.map((d) => Math.max(d.fitness, d.fatigue)), 10);
  const step = Math.ceil((max * 1.1) / 4 / 5) * 5;
  const every = Math.ceil(days.length / 5);
  const spacing = width / days.length;
  return (
    <View onLayout={onLayout} style={{overflow: 'hidden'}}>
      <View style={{flexDirection: 'row', gap: 16, marginBottom: 6}}>
        {[{c: chart.series[0], l: 'Fitness'}, {c: chart.series[1], l: 'Fatigue'}].map((x) => (
          <View key={x.l} style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <View style={{width: 10, height: 3, backgroundColor: x.c}} />
            <Text variant="labelSmall" style={{color: chart.inkSecondary}}>{x.l}</Text>
          </View>
        ))}
      </View>
      <LineChart
        data={days.map((d, i) => ({value: d.fitness, label: i % every === 0 ? label(d.date) : ''}))}
        data2={days.map((d) => ({value: d.fatigue}))}
        height={height}
        width={width}
        spacing={spacing}
        initialSpacing={0}
        endSpacing={0}
        thickness={2}
        color={chart.series[0]}
        color2={chart.series[1]}
        hideDataPoints
        maxValue={step * 4}
        stepValue={step}
        noOfSections={4}
        yAxisTextStyle={{color: chart.inkMuted, fontSize: 10}}
        xAxisLabelTextStyle={{color: chart.inkMuted, fontSize: 10, width: 48}}
        rulesColor={chart.grid}
        rulesType="solid"
        xAxisColor={chart.axis}
        yAxisColor="transparent"
        yAxisLabelWidth={Y}
        disableScroll
      />
    </View>
  );
}
