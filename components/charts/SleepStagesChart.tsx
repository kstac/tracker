import {useState} from 'react';
import {View} from 'react-native';
import {BarChart} from 'react-native-gifted-charts';
import {Text} from 'react-native-paper';
import {formatMinutes, nightOf, nightLabel, parseIsoDate} from '@/lib/dates';
import {SleepNight} from '@/metrics/types';
import {useAppTheme} from '@/theme';
import {useChartWidth} from '@/components/charts/useChartWidth';

const STAGES = [
  {key: 'deepMin', label: 'Deep'},
  {key: 'lightMin', label: 'Light'},
  {key: 'remMin', label: 'REM'},
  {key: 'awakeMin', label: 'Awake'},
] as const;

export default function SleepStagesChart({nights, height = 180}: {nights: SleepNight[]; height?: number}) {
  const {chart} = useAppTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const {onLayout, width, ready} = useChartWidth(36);
  if (!nights.length) return <Text style={{color: chart.inkMuted, padding: 16}}>No sleep recorded yet</Text>;
  if (!ready) return <View onLayout={onLayout} style={{height: height + 80}} />;

  const slot = width / nights.length;
  const barWidth = Math.max(4, slot * 0.65);
  const gap = 2;
  const stackData = nights.map((n, i) => ({
    label: i % Math.ceil(nights.length / 5) === 0 ? parseIsoDate(nightOf(n.date)).toLocaleDateString(undefined, {day: 'numeric', month: 'short'}) : '',
    onPress: () => setSelected(i),
    stacks: STAGES.map((s, si) => ({
      value: n[s.key] / 60,
      color: chart.series[si],
      marginBottom: si === 0 ? 0 : gap,
    })),
  }));
  const maxHours = Math.ceil(Math.max(...nights.map((n) => (n.deepMin + n.lightMin + n.remMin + n.awakeMin) / 60), 8));
  const sel = selected != null ? nights[selected] : null;

  return (
    <View onLayout={onLayout} style={{overflow: 'hidden'}}>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8}}>
        {STAGES.map((s, i) => (
          <View key={s.key} style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            <View style={{width: 10, height: 10, borderRadius: 2, backgroundColor: chart.series[i]}} />
            <Text variant="labelSmall" style={{color: chart.inkSecondary}}>{s.label}</Text>
          </View>
        ))}
      </View>
      <View style={{minHeight: 20, marginBottom: 4}}>
        <Text variant="bodySmall" style={{color: sel ? chart.inkSecondary : chart.inkMuted}}>
          {sel
            ? `${nightLabel(sel.date)} · ` +
              STAGES.map((s) => `${s.label} ${formatMinutes(sel[s.key])}`).join(' · ')
            : 'Tap a night to see its stages'}
        </Text>
      </View>
      <BarChart
        stackData={stackData}
        height={height}
        width={width}
        barWidth={barWidth}
        spacing={slot - barWidth}
        initialSpacing={(slot - barWidth) / 2}
        endSpacing={0}
        maxValue={maxHours}
        noOfSections={4}
        stackBorderTopLeftRadius={Math.min(4, barWidth / 2)}
        stackBorderTopRightRadius={Math.min(4, barWidth / 2)}
        formatYLabel={(l: string) => `${Math.round(Number(l))}h`}
        yAxisTextStyle={{color: chart.inkMuted, fontSize: 10}}
        xAxisLabelTextStyle={{color: chart.inkMuted, fontSize: 10, width: 48}}
        rulesColor={chart.grid}
        rulesType="solid"
        xAxisColor={chart.axis}
        yAxisColor="transparent"
        yAxisLabelWidth={36}
        disableScroll
      />
    </View>
  );
}
