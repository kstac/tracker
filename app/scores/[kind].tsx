import {useMemo, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {Stack, useLocalSearchParams} from 'expo-router';
import {IconButton, SegmentedButtons, Text} from 'react-native-paper';
import TrendChart from '@/components/charts/TrendChart';
import {ContributorList} from '@/components/ScoreDetails';
import {scoreColor} from '@/components/ScoreRing';
import {isScoreKind, SCORE_DEFS} from '@/components/scores/defs';
import {useScoreHistory} from '@/components/scores/useScoreHistory';
import IconBadge from '@/components/ui/IconBadge';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {addDays, IsoDate, parseIsoDate, today} from '@/lib/dates';
import {average, Bucket, bucketize, minMax, Point} from '@/lib/series';
import {useAppTheme} from '@/theme';

const RANGES = [
  {value: '30', label: '1M', days: 30, bucket: 'day'},
  {value: '90', label: '3M', days: 90, bucket: 'day'},
  {value: '365', label: '1Y', days: 365, bucket: 'week'},
] as const;

function Stat({label, value, sub}: {label: string; value: string; sub?: string}) {
  const {chart} = useAppTheme();
  return (
    <View style={{flex: 1}}>
      <Text variant="labelMedium" style={{color: chart.inkSecondary}}>{label}</Text>
      <Text variant="titleLarge" style={{color: chart.inkPrimary, fontWeight: '700'}}>{value}</Text>
      {sub ? <Text variant="labelSmall" style={{color: chart.inkMuted}}>{sub}</Text> : null}
    </View>
  );
}

export default function ScoreHistoryScreen() {
  const {kind: rawKind} = useLocalSearchParams<{kind: string}>();
  const kind = isScoreKind(rawKind) ? rawKind : 'readiness';
  const def = SCORE_DEFS[kind];
  const {chart} = useAppTheme();
  const color = chart.category[def.category];
  const history = useScoreHistory();
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['value']>('30');
  const end = today();
  const [day, setDay] = useState<IsoDate>(end);

  const range = RANGES.find((r) => r.value === rangeKey)!;
  const from = addDays(end, -(range.days - 1));
  const raw = useMemo<Point[]>(
    () => history.days.flatMap((d) => (d.date >= from && d[kind] ? [{date: d.date, value: d[kind]!.value}] : [])),
    [history, kind, from],
  );
  const points = useMemo(() => bucketize(raw, range.bucket as Bucket, 'mean'), [raw, range.bucket]);
  const calibratingDays = history.days.filter((d) => d.date >= from && d[kind]?.calibrating).length;

  const avg = average(raw);
  const mm = minMax(raw);
  const selected = history.details(day, kind);
  const fmtDay = (d: IsoDate) => parseIsoDate(d).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'});

  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingBottom: 32}}>
      <Stack.Screen options={{title: `${def.label} history`}} />
      <View style={{padding: 16}}>
        <SegmentedButtons
          value={rangeKey}
          onValueChange={(v) => setRangeKey(v as typeof rangeKey)}
          density="small"
          buttons={RANGES.map((r) => ({value: r.value, label: r.label}))}
        />
      </View>

      <Panel>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12}}>
          <IconBadge icon={def.icon} color={color} size={44} />
          <View style={{flex: 1}}>
            <Text variant="labelMedium" style={{color: chart.inkSecondary}}>Average · {range.label}</Text>
            <Text variant="headlineMedium" style={{color: chart.inkPrimary, fontWeight: '700'}}>{avg == null ? '–' : Math.round(avg)}</Text>
          </View>
        </View>
        <TrendChart def={def} points={points} bucketLabel={range.bucket} average={avg} color={color} />
        {calibratingDays > 0 && (
          <Text variant="labelSmall" style={{color: chart.inkMuted, marginTop: 4}}>
            {calibratingDays} {calibratingDays === 1 ? 'day was' : 'days were'} scored while your baseline was still calibrating.
          </Text>
        )}
      </Panel>

      <Panel style={{flexDirection: 'row'}}>
        <Stat label="Days scored" value={String(raw.length)} />
        <Stat label="Best" value={mm ? String(Math.round(mm.max.value)) : '–'} sub={mm ? fmtDay(mm.max.date) : undefined} />
        <Stat label="Lowest" value={mm ? String(Math.round(mm.min.value)) : '–'} sub={mm ? fmtDay(mm.min.date) : undefined} />
      </Panel>

      <Panel>
        <PanelHeader
          title={day === end ? 'Today' : fmtDay(day)}
          subtitle={selected ? `${selected.value} · ${selected.calibrating ? 'Calibrating' : selected.label}` : 'No score for this day'}
          icon="calendar-today"
          color={selected ? scoreColor(selected.label, chart.status) : chart.inkMuted}
          right={
            <View style={{flexDirection: 'row'}}>
              <IconButton icon="chevron-left" size={20} onPress={() => setDay(addDays(day, -1))} accessibilityLabel="Previous day" />
              <IconButton icon="chevron-right" size={20} disabled={day >= end} onPress={() => setDay(addDays(day, 1))} accessibilityLabel="Next day" />
            </View>
          }
        />
        {selected ? (
          <ContributorList contributors={selected.contributors} />
        ) : (
          <Text style={{color: chart.inkMuted}}>Not enough data on this day to score it.</Text>
        )}
      </Panel>
    </ScrollView>
  );
}
