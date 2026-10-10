import {useMemo, useState} from 'react';
import {View} from 'react-native';
import {BarChart, LineChart} from 'react-native-gifted-charts';
import {Text} from 'react-native-paper';
import {IsoDate, parseIsoDate} from '@/lib/dates';
import {formatMetricValue} from '@/lib/format';
import {Point} from '@/lib/series';
import {MetricDef} from '@/metrics/registry';
import {useAppTheme} from '@/theme';
import {useChartWidth} from '@/components/charts/useChartWidth';

type Props = {
  def: MetricDef;
  points: Point[];
  bucketLabel?: 'day' | 'week' | 'month';
  average?: number | null;
  highlight?: {dates: Set<IsoDate>; label: string};
  height?: number;
  color?: string;
};

const SECTIONS = 4;
const Y_LABEL_WIDTH = 44;

function shortDate(date: IsoDate, bucket: Props['bucketLabel']) {
  const d = parseIsoDate(date);
  if (bucket === 'month') return d.toLocaleDateString(undefined, {month: 'short', year: '2-digit'});
  return d.toLocaleDateString(undefined, {day: 'numeric', month: 'short'});
}

export function niceRange(values: number[], zeroBased: boolean, cap?: number) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (zeroBased) min = Math.min(0, min);
  if (min === max) {
    max += 1;
    min = zeroBased ? min : min - 1;
  }
  const pad = (max - min) * 0.1;
  const lo = zeroBased ? min : Math.floor(min - pad);
  const hi = Math.ceil(max + pad);
  const step = Math.max(1, Math.ceil((hi - lo) / SECTIONS));
  if (cap != null && lo + step * SECTIONS > cap) {
    const capped = Math.max(1, Math.ceil((cap - lo) / SECTIONS));
    const top = lo + capped * SECTIONS;
    return top > cap ? {lo: cap - capped * SECTIONS, step: capped, hi: cap} : {lo, step: capped, hi: top};
  }
  return {lo, step, hi: lo + step * SECTIONS};
}

export default function TrendChart({def, points, bucketLabel = 'day', average, highlight, height = 200, color}: Props) {
  const {chart} = useAppTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const {onLayout, width, ready} = useChartWidth(Y_LABEL_WIDTH);
  const lineColor = color ?? chart.series[0];

  const isBar = def.chart === 'bar';
  const range = useMemo(() => (points.length ? niceRange(points.map((p) => p.value), isBar, def.max) : null), [points, isBar, def.max]);

  if (!ready) return <View onLayout={onLayout} style={{height: height + 40}} />;

  if (!points.length || !range) {
    return (
      <View onLayout={onLayout} style={{height, alignItems: 'center', justifyContent: 'center'}}>
        <Text style={{color: chart.inkMuted}}>No data for this range yet</Text>
      </View>
    );
  }

  const labelEvery = Math.max(1, Math.ceil(points.length / 5));
  const spacing = Math.max(2, width / Math.max(1, points.length));
  const fmtAxis = (label: string) => formatMetricValue(def, Number(label), false);
  const xLabel = (i: number, p: Point) => (i % labelEvery === 0 ? shortDate(p.date, bucketLabel) : '');
  const axisText = {color: chart.inkMuted, fontSize: 10};
  const sel = selected != null ? points[selected] : null;

  const readout = (
    <View style={{minHeight: 20, marginBottom: 4}}>
      {sel ? (
        <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
          {shortDate(sel.date, bucketLabel)}
          {bucketLabel !== 'day' ? ` (${bucketLabel} avg)` : ''} · <Text style={{color: chart.inkPrimary, fontWeight: '600'}}>{formatMetricValue(def, sel.value)}</Text>
          {highlight?.dates.has(sel.date) ? ` · ${highlight.label}` : ''}
        </Text>
      ) : (
        <Text variant="bodySmall" style={{color: chart.inkMuted}}>Tap the chart to see values</Text>
      )}
    </View>
  );

  const reference =
    average != null
      ? {
          showReferenceLine1: true,
          referenceLine1Position: isBar ? average : average - range.lo,
          referenceLine1Config: {color: chart.inkMuted, dashWidth: 4, dashGap: 4, thickness: 1},
        }
      : {};

  if (isBar) {
    const barWidth = Math.max(2, spacing * 0.7);
    const data = points.map((p, i) => ({
      value: p.value,
      label: xLabel(i, p),
      frontColor:
        selected === i ? chart.inkPrimary : highlight?.dates.has(p.date) ? chart.series[1] : lineColor,
      onPress: () => setSelected(i),
    }));
    return (
      <View onLayout={onLayout} style={{overflow: 'hidden'}}>
        {readout}
        <BarChart
          data={data}
          height={height}
          width={width}
          barWidth={barWidth}
          spacing={spacing - barWidth}
          initialSpacing={spacing / 2}
          endSpacing={0}
          barBorderTopLeftRadius={Math.min(4, barWidth / 2)}
          barBorderTopRightRadius={Math.min(4, barWidth / 2)}
          maxValue={range.hi}
          noOfSections={SECTIONS}
          stepValue={range.step}
          formatYLabel={fmtAxis}
          yAxisTextStyle={axisText}
          xAxisLabelTextStyle={{...axisText, width: 48}}
          rulesColor={chart.grid}
          rulesType="solid"
          xAxisColor={chart.axis}
          yAxisColor="transparent"
          yAxisLabelWidth={Y_LABEL_WIDTH}
          disableScroll
          {...reference}
        />
      </View>
    );
  }

  const data = points.map((p, i) => ({
    value: p.value - range.lo,
    label: xLabel(i, p),
    hideDataPoint: !highlight?.dates.has(p.date),
    dataPointColor: chart.series[1],
    dataPointRadius: 4,
  }));
  return (
    <View onLayout={onLayout} style={{overflow: 'hidden'}}>
      <Text variant="bodySmall" style={{color: chart.inkMuted, marginBottom: 4}}>Touch and drag to see values</Text>
      <LineChart
        data={data}
        height={height}
        width={width}
        spacing={spacing}
        initialSpacing={spacing / 2}
        endSpacing={0}
        thickness={2}
        color={lineColor}
        curved={points.length > 2}
        curvature={0.15}
        areaChart
        startFillColor={lineColor}
        endFillColor={lineColor}
        startOpacity={0.22}
        endOpacity={0.02}
        maxValue={range.hi - range.lo}
        noOfSections={SECTIONS}
        stepValue={range.step}
        formatYLabel={(l: string) => formatMetricValue(def, Number(l) + range.lo, false)}
        yAxisTextStyle={axisText}
        xAxisLabelTextStyle={{...axisText, width: 48}}
        rulesColor={chart.grid}
        rulesType="solid"
        xAxisColor={chart.axis}
        yAxisColor="transparent"
        yAxisLabelWidth={Y_LABEL_WIDTH}
        disableScroll
        pointerConfig={{
          pointerStripColor: chart.axis,
          pointerStripWidth: 1,
          pointerColor: lineColor,
          radius: 5,
          activatePointersInstantlyOnTouch: true,
          persistPointer: true,
          autoAdjustPointerLabelPosition: true,
          pointerLabelWidth: 120,
          pointerLabelHeight: 44,
          shiftPointerLabelY: -8,
          pointerLabelComponent: (_items: unknown, _secondary: unknown, index: number) => {
            const p = points[index];
            if (!p) return null;
            return (
              <View style={{backgroundColor: chart.surface, borderColor: chart.grid, borderWidth: 1, borderRadius: 8, padding: 6}}>
                <Text variant="labelSmall" style={{color: chart.inkSecondary}}>
                  {shortDate(p.date, bucketLabel)}{bucketLabel !== 'day' ? ` · ${bucketLabel} avg` : ''}
                </Text>
                <Text variant="labelLarge" style={{color: chart.inkPrimary}}>{formatMetricValue(def, p.value)}</Text>
              </View>
            );
          },
        }}
        {...reference}
      />
    </View>
  );
}
