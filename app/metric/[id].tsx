import {useEffect, useMemo, useState} from 'react';
import {Alert, ScrollView, View} from 'react-native';
import {Stack, useLocalSearchParams} from 'expo-router';
import {Button, Chip, DataTable, IconButton, SegmentedButtons, Text} from 'react-native-paper';
import ManualValueDialog from '@/components/ManualValueDialog';
import IntradayChart from '@/components/charts/IntradayChart';
import TrendChart from '@/components/charts/TrendChart';
import {getSamples} from '@/db/repo';
import {addDays, IsoDate, parseIsoDate, startOfDayTs, today} from '@/lib/dates';
import {formatMetricValue} from '@/lib/format';
import DeltaPill from '@/components/ui/DeltaPill';
import IconBadge from '@/components/ui/IconBadge';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {average, Bucket, bucketize, minMax, seriesFor} from '@/lib/series';
import {METRIC_BY_ID} from '@/metrics/registry';
import {MetricId, Sample, SampleMetric} from '@/metrics/types';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const RANGES = [
  {value: '7', label: '1W', days: 7, bucket: 'day'},
  {value: '30', label: '1M', days: 30, bucket: 'day'},
  {value: '90', label: '3M', days: 90, bucket: 'day'},
  {value: '365', label: '1Y', days: 365, bucket: 'week'},
  {value: 'all', label: 'All', days: null, bucket: 'month'},
] as const;

const INTRADAY: Partial<Record<MetricId, {metric: SampleMetric; unit: string}>> = {
  hr_avg: {metric: 'heart_rate', unit: 'bpm'},
  hr_min: {metric: 'heart_rate', unit: 'bpm'},
  hr_max: {metric: 'heart_rate', unit: 'bpm'},
  resting_hr: {metric: 'heart_rate', unit: 'bpm'},
  stress_avg: {metric: 'stress', unit: ''},
  stress_max: {metric: 'stress', unit: ''},
  body_battery_high: {metric: 'body_battery', unit: ''},
  body_battery_low: {metric: 'body_battery', unit: ''},
  body_battery_wake: {metric: 'body_battery', unit: ''},
};

export default function MetricScreen() {
  const {id} = useLocalSearchParams<{id: MetricId}>();
  const def = METRIC_BY_ID[id];
  const {chart} = useAppTheme();
  const {daily, tags, tagEntries, setManualValue} = useAppData();
  const [adding, setAdding] = useState(false);
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['value']>('30');
  const [tagId, setTagId] = useState<string | null>(null);
  const [day, setDay] = useState<IsoDate>(today());
  const [samples, setSamples] = useState<Sample[]>([]);
  const intraday = INTRADAY[id];

  useEffect(() => {
    if (!intraday) return;
    getSamples(intraday.metric, startOfDayTs(day), startOfDayTs(addDays(day, 1))).then(setSamples);
  }, [intraday, day]);

  const range = RANGES.find((r) => r.value === rangeKey)!;
  const end = today();
  const from = range.days ? addDays(end, -(range.days - 1)) : undefined;
  const raw = useMemo(() => (def ? seriesFor(daily, def.id, from, end) : []), [daily, def, from, end]);
  const prev = useMemo(
    () => (def && range.days ? seriesFor(daily, def.id, addDays(from!, -range.days), addDays(from!, -1)) : []),
    [daily, def, from, range.days],
  );
  const points = useMemo(() => (def ? bucketize(raw, range.bucket as Bucket, def.rollup) : []), [raw, range.bucket, def]);
  const taggedDates = useMemo(
    () => new Set(tagEntries.filter((e) => e.tagId === tagId && e.value > 0).map((e) => e.date)),
    [tagEntries, tagId],
  );

  if (!def) return <Text style={{padding: 16}}>Unknown metric</Text>;

  const avg = average(raw);
  const prevAvg = average(prev);
  const mm = minMax(raw);
  const tag = tags.find((t) => t.id === tagId);
  const taggedAvg = tag ? average(raw.filter((p) => taggedDates.has(p.date))) : null;
  const untaggedAvg = tag ? average(raw.filter((p) => !taggedDates.has(p.date))) : null;
  const fmt = (v: number | null | undefined) => formatMetricValue(def, v);
  const color = chart.category[def.category];
  const fmtDay = (d: IsoDate) => parseIsoDate(d).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'});

  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingBottom: 32}}>
      <Stack.Screen options={{title: def.label}} />
      <View style={{padding: 16}}>
        <SegmentedButtons
          value={rangeKey}
          onValueChange={(v) => setRangeKey(v as typeof rangeKey)}
          density="small"
          buttons={RANGES.map((r) => ({value: r.value, label: r.label}))}
        />
      </View>

      {def.manualEntry && (
        <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginHorizontal: 16, marginTop: -8, marginBottom: 8}}>
          <Button icon="plus" mode="contained-tonal" onPress={() => setAdding(true)}>Add a reading</Button>
        </View>
      )}

      <Panel>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12}}>
          <IconBadge icon={def.icon} color={color} size={44} />
          <View style={{flex: 1}}>
            <Text variant="labelMedium" style={{color: chart.inkSecondary}}>Average · {range.label}</Text>
            <Text variant="headlineMedium" style={{color: chart.inkPrimary, fontWeight: '700'}}>{fmt(avg)}</Text>
          </View>
          {avg != null && prevAvg != null && <DeltaPill def={def} delta={avg - prevAvg} suffix={`vs prev ${range.label}`} />}
        </View>
        <TrendChart def={def} points={points} bucketLabel={range.bucket} average={avg} color={color} highlight={tag ? {dates: taggedDates, label: tag.name} : undefined} />
        <Text variant="labelSmall" style={{color: chart.inkMuted, marginTop: 4}}>Dashed line: average for this range</Text>
      </Panel>

      {tags.length > 0 && (
        <Panel>
          <PanelHeader title="Compare with a tag" subtitle={tag ? 'Tagged days are highlighted in the chart' : 'Highlight days you logged a tag'} icon="tag-outline" color={chart.series[1]} />
          <View>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {tags.map((t) => (
                <Chip key={t.id} selected={t.id === tagId} showSelectedOverlay onPress={() => setTagId(t.id === tagId ? null : t.id)}>{t.name}</Chip>
              ))}
            </View>
            {tag && (
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12}}>
                <View style={{width: 10, height: 10, borderRadius: 5, backgroundColor: chart.series[1]}} />
                <Text variant="bodyMedium" style={{color: chart.inkSecondary}}>
                  {tag.name}: {fmt(taggedAvg)} · other days: {fmt(untaggedAvg)}
                </Text>
              </View>
            )}
          </View>
        </Panel>
      )}

      <Panel padded={false}>
        <DataTable>
          <DataTable.Row>
            <DataTable.Cell>Days with data</DataTable.Cell>
            <DataTable.Cell numeric>{raw.length}</DataTable.Cell>
          </DataTable.Row>
          <DataTable.Row>
            <DataTable.Cell>Lowest</DataTable.Cell>
            <DataTable.Cell numeric>{mm ? `${fmt(mm.min.value)} · ${fmtDay(mm.min.date)}` : '–'}</DataTable.Cell>
          </DataTable.Row>
          <DataTable.Row>
            <DataTable.Cell>Highest</DataTable.Cell>
            <DataTable.Cell numeric>{mm ? `${fmt(mm.max.value)} · ${fmtDay(mm.max.date)}` : '–'}</DataTable.Cell>
          </DataTable.Row>
          <DataTable.Row>
            <DataTable.Cell>Latest</DataTable.Cell>
            <DataTable.Cell numeric>{raw.length ? `${fmt(raw[raw.length - 1].value)} · ${fmtDay(raw[raw.length - 1].date)}` : '–'}</DataTable.Cell>
          </DataTable.Row>
        </DataTable>
      </Panel>

      {intraday && (
        <Panel>
          <PanelHeader
            title="During the day"
            subtitle={fmtDay(day)}
            icon="clock-outline"
            color={color}
            right={
              <View style={{flexDirection: 'row'}}>
                <IconButton icon="chevron-left" size={20} onPress={() => setDay(addDays(day, -1))} />
                <IconButton icon="chevron-right" size={20} disabled={day >= end} onPress={() => setDay(addDays(day, 1))} />
              </View>
            }
          />
          <IntradayChart samples={samples} unit={intraday.unit} color={color} />
        </Panel>
      )}

      <Panel padded={false}>
        <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '600', padding: 16, paddingBottom: 4}}>Recent days</Text>
        <DataTable>
          {[...raw].reverse().slice(0, 14).map((p) => (
            <DataTable.Row
              key={p.date}
              onLongPress={def.manualEntry ? () => Alert.alert('Delete this reading?', `${fmtDay(p.date)}: ${fmt(p.value)}. Synced values for the day stay.`, [
                {text: 'Cancel', style: 'cancel'},
                {text: 'Delete', style: 'destructive', onPress: () => setManualValue(def.id, p.date, null)},
              ]) : undefined}
            >
              <DataTable.Cell>{fmtDay(p.date)}</DataTable.Cell>
              <DataTable.Cell numeric>{fmt(p.value)}</DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable>
      </Panel>
      <ManualValueDialog
        def={adding ? def : null}
        onDismiss={() => setAdding(false)}
        onSubmit={async (date, value) => {
          setAdding(false);
          await setManualValue(def.id, date, value);
        }}
      />
    </ScrollView>
  );
}
