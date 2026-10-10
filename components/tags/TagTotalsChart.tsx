import {useState} from 'react';
import {View} from 'react-native';
import {BarChart} from 'react-native-gifted-charts';
import {Text} from 'react-native-paper';
import {useChartWidth} from '@/components/charts/useChartWidth';
import {formatTagAmount, TagPeriodTotal} from '@/insights/tagStats';
import {addDays, parseIsoDate} from '@/lib/dates';
import {useAppTheme} from '@/theme';

type Props = {
  periods: TagPeriodTotal[];
  bucket: 'week' | 'month';
  unit: string | null;
  color: string;
  weeklyLimit: number | null;
  height?: number;
};

const SECTIONS = 4;
const Y_LABEL_WIDTH = 36;

function label(start: string, bucket: Props['bucket']) {
  const d = parseIsoDate(start);
  return bucket === 'month'
    ? d.toLocaleDateString(undefined, {month: 'short', year: '2-digit'})
    : d.toLocaleDateString(undefined, {day: 'numeric', month: 'short'});
}

export default function TagTotalsChart({periods, bucket, unit, color, weeklyLimit, height = 180}: Props) {
  const {chart} = useAppTheme();
  const {onLayout, width, ready} = useChartWidth(Y_LABEL_WIDTH);
  const [selected, setSelected] = useState<number | null>(null);
  if (!ready) return <View onLayout={onLayout} style={{height: height + 40}} />;
  if (!periods.length) return <Text style={{color: chart.inkMuted}}>Nothing logged yet</Text>;

  const limit = bucket === 'week' ? weeklyLimit : null;
  const maxValue = Math.max(...periods.map((p) => p.total), limit ?? 0, 1);
  const step = Math.max(1, Math.ceil((maxValue * 1.1) / SECTIONS));
  const slot = width / periods.length;
  const barWidth = Math.max(2, slot * 0.7);
  const labelEvery = Math.max(1, Math.ceil(periods.length / 5));
  const sel = selected != null ? periods[selected] : null;

  const data = periods.map((p, i) => ({
    value: p.total,
    label: i % labelEvery === 0 ? label(p.start, bucket) : '',
    frontColor: selected === i ? chart.inkPrimary : limit != null && p.total > limit ? chart.status.critical : color,
    onPress: () => setSelected(i),
  }));

  return (
    <View onLayout={onLayout} style={{overflow: 'hidden'}}>
      <View style={{minHeight: 20, marginBottom: 4}}>
        <Text variant="bodySmall" style={{color: sel ? chart.inkSecondary : chart.inkMuted}}>
          {sel
            ? `${bucket === 'week' ? `Week of ${label(sel.start, 'week')}` : label(sel.start, 'month')} · ${formatTagAmount(sel.total, unit)} on ${sel.days} ${sel.days === 1 ? 'day' : 'days'}`
            : 'Tap a bar to see its total'}
        </Text>
      </View>
      <BarChart
        data={data}
        height={height}
        width={width}
        barWidth={barWidth}
        spacing={slot - barWidth}
        initialSpacing={(slot - barWidth) / 2}
        endSpacing={0}
        barBorderTopLeftRadius={Math.min(4, barWidth / 2)}
        barBorderTopRightRadius={Math.min(4, barWidth / 2)}
        maxValue={step * SECTIONS}
        stepValue={step}
        noOfSections={SECTIONS}
        yAxisTextStyle={{color: chart.inkMuted, fontSize: 10}}
        xAxisLabelTextStyle={{color: chart.inkMuted, fontSize: 10, width: 48}}
        rulesColor={chart.grid}
        rulesType="solid"
        xAxisColor={chart.axis}
        yAxisColor="transparent"
        yAxisLabelWidth={Y_LABEL_WIDTH}
        disableScroll
        {...(limit != null
          ? {
              showReferenceLine1: true,
              referenceLine1Position: limit,
              referenceLine1Config: {color: chart.status.critical, dashWidth: 4, dashGap: 4, thickness: 1},
            }
          : {})}
      />
      {limit != null && (
        <Text variant="labelSmall" style={{color: chart.inkMuted, marginTop: 4}}>
          Dashed line: weekly limit of {formatTagAmount(limit, unit)}
        </Text>
      )}
    </View>
  );
}

export function rangeStart(range: '3m' | '1y' | 'all', today: string, firstDate: string | null) {
  if (range === '3m') return addDays(today, -90);
  if (range === '1y') return addDays(today, -364);
  return firstDate ?? today;
}
