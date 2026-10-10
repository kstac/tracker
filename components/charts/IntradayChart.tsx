import {View} from 'react-native';
import {LineChart} from 'react-native-gifted-charts';
import {Text} from 'react-native-paper';
import {Sample} from '@/metrics/types';
import {useAppTheme} from '@/theme';
import {useChartWidth} from '@/components/charts/useChartWidth';

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});

/** Downsamples to roughly one point per 10 minutes so a full day stays smooth to render. */
function downsample(samples: Sample[], bucketMs = 10 * 60_000) {
  const out: {ts: number; value: number}[] = [];
  let bucket = -1;
  let sum = 0;
  let n = 0;
  for (const s of samples) {
    const b = Math.floor(s.ts / bucketMs);
    if (b !== bucket && n) {
      out.push({ts: bucket * bucketMs, value: sum / n});
      sum = 0;
      n = 0;
    }
    bucket = b;
    sum += s.value;
    n++;
  }
  if (n) out.push({ts: bucket * bucketMs, value: sum / n});
  return out;
}

export default function IntradayChart({samples, unit, height = 160, color}: {samples: Sample[]; unit: string; height?: number; color?: string}) {
  const {chart} = useAppTheme();
  const lineColor = color ?? chart.series[0];
  const {onLayout, width, ready} = useChartWidth(36);
  const points = downsample(samples);
  if (!ready) return <View onLayout={onLayout} style={{height: height + 30}} />;
  if (points.length < 2) return <Text style={{color: chart.inkMuted, paddingVertical: 16}}>No detailed readings for this day</Text>;

  const values = points.map((p) => p.value);
  const lo = Math.max(0, Math.floor(Math.min(...values) - 5));
  const hi = Math.ceil(Math.max(...values) + 5);
  const labelEvery = Math.ceil(points.length / 4);
  const data = points.map((p, i) => ({value: p.value - lo, label: i % labelEvery === 0 ? fmtTime(p.ts) : ''}));

  return (
    <View onLayout={onLayout} style={{overflow: 'hidden'}}>
      <LineChart
        data={data}
        height={height}
        width={width}
        spacing={width / points.length}
        initialSpacing={0}
        thickness={2}
        color={lineColor}
        hideDataPoints
        maxValue={hi - lo}
        noOfSections={4}
        formatYLabel={(l: string) => String(Math.round(Number(l) + lo))}
        yAxisTextStyle={{color: chart.inkMuted, fontSize: 10}}
        xAxisLabelTextStyle={{color: chart.inkMuted, fontSize: 10, width: 48}}
        rulesColor={chart.grid}
        rulesType="solid"
        xAxisColor={chart.axis}
        yAxisColor="transparent"
        yAxisLabelWidth={36}
        disableScroll
        pointerConfig={{
          pointerStripColor: chart.axis,
          pointerStripWidth: 1,
          pointerColor: lineColor,
          radius: 5,
          activatePointersInstantlyOnTouch: true,
          persistPointer: true,
          autoAdjustPointerLabelPosition: true,
          pointerLabelWidth: 100,
          pointerLabelHeight: 40,
          pointerLabelComponent: (_i: unknown, _s: unknown, index: number) => {
            const p = points[index];
            if (!p) return null;
            return (
              <View style={{backgroundColor: chart.surface, borderColor: chart.grid, borderWidth: 1, borderRadius: 8, padding: 6}}>
                <Text variant="labelSmall" style={{color: chart.inkSecondary}}>{fmtTime(p.ts)}</Text>
                <Text variant="labelLarge" style={{color: chart.inkPrimary}}>{`${Math.round(p.value)} ${unit}`.trim()}</Text>
              </View>
            );
          },
        }}
      />
    </View>
  );
}
