import {useMemo} from 'react';
import {ScrollView, View} from 'react-native';
import {router, Stack, useLocalSearchParams} from 'expo-router';
import {IconButton, Text} from 'react-native-paper';
import {EffectRow, openFactor} from '@/components/effects/EffectList';
import {scoreColor} from '@/components/ScoreRing';
import CollapsiblePanel from '@/components/ui/CollapsiblePanel';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {computeMonthReport, computeRadar, monthEnd, MonthStats, shiftMonth} from '@/insights';
import {scoreLabel} from '@/insights/score';
import {formatTagAmount, monthStart} from '@/insights/tagStats';
import {dateRange, dayOfWeek, formatMinutes, parseIsoDate, today} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Compare({label, cur, prev, fmt, higherIsBetter}: {label: string; cur: number | null; prev: number | null; fmt: (v: number) => string; higherIsBetter: boolean | null}) {
  const {chart} = useAppTheme();
  if (cur == null && prev == null) return null;
  const diff = cur != null && prev != null ? cur - prev : null;
  const color = diff == null || diff === 0 || higherIsBetter == null ? chart.inkSecondary : (diff > 0) === higherIsBetter ? chart.deltaGood : chart.status.critical;
  return (
    <View style={{flexDirection: 'row', paddingVertical: 4}}>
      <Text variant="bodySmall" style={{flex: 1, color: chart.inkSecondary}}>{label}</Text>
      <Text variant="bodySmall" style={{width: 80, textAlign: 'right', color: chart.inkPrimary, fontWeight: '600'}}>{cur == null ? '–' : fmt(cur)}</Text>
      <Text variant="bodySmall" style={{width: 80, textAlign: 'right', color}}>{prev == null ? '–' : fmt(prev)}</Text>
    </View>
  );
}

const n0 = (v: number) => String(Math.round(v));
const rows = (a: MonthStats, b: MonthStats) => [
  {label: 'Readiness', cur: a.readiness, prev: b.readiness, fmt: n0, hib: true},
  {label: 'Sleep score', cur: a.sleepScore, prev: b.sleepScore, fmt: n0, hib: true},
  {label: 'Sleep per night', cur: a.sleepMin, prev: b.sleepMin, fmt: formatMinutes, hib: true},
  {label: 'Bedtime variation', cur: a.bedtimeSd, prev: b.bedtimeSd, fmt: formatMinutes, hib: false},
  {label: 'Steps per day', cur: a.steps, prev: b.steps, fmt: (v: number) => Math.round(v).toLocaleString(), hib: true},
  {label: 'Daily training load', cur: a.load, prev: b.load, fmt: n0, hib: null},
  {label: 'Workouts', cur: a.workouts, prev: b.workouts, fmt: n0, hib: null},
  {label: 'Resting HR', cur: a.restingHr, prev: b.restingHr, fmt: (v: number) => `${v.toFixed(1)} bpm`, hib: false},
  {label: 'Average stress', cur: a.stress, prev: b.stress, fmt: n0, hib: false},
  {label: 'Body Battery peak', cur: a.bodyBatteryHigh, prev: b.bodyBatteryHigh, fmt: n0, hib: true},
  {label: 'Weight', cur: a.weight, prev: b.weight, fmt: (v: number) => `${v.toFixed(1)} kg`, hib: null},
];

export default function MonthReportScreen() {
  const {month: raw} = useLocalSearchParams<{month: string}>();
  const month = monthStart(raw ?? today());
  const {chart} = useAppTheme();
  const {report, daily, activities, tags, tagEntries} = useAppData();
  const data = useMemo(() => {
    if (!report) return null;
    const loads = new Map(report.load.days.map((d) => [d.date, d.load]));
    const last = monthEnd(month) < today() ? monthEnd(month) : today();
    const radarHistory = new Map(dateRange(month, last).map((d) => [d, computeRadar(daily, d, {loads, chronicLoad: report.load.chronic}).level]));
    return computeMonthReport(
      {
        today: today(),
        daily,
        history: report.history.days,
        loads,
        activities,
        tags,
        tagEntries,
        radarHistory,
        effects: report.effects.effects,
      },
      month,
    );
  }, [report, daily, activities, tags, tagEntries, month]);
  if (!data) return null;
  const isCurrent = month === monthStart(today());
  const go = (by: number) => router.setParams({month: shiftMonth(month, by)});
  const firstDow = (dayOfWeek(data.calendar[0].date) + 6) % 7;
  const cells = [...Array(firstDow).fill(null), ...data.calendar];
  const maxSteps = Math.max(...data.weekday.steps.map((v) => v ?? 0), 1);

  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingTop: 8, paddingBottom: 32}}>
      <Stack.Screen options={{title: data.label}} />
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8}}>
        <IconButton icon="chevron-left" onPress={() => go(-1)} />
        <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>{data.label}{data.partial ? ' so far' : ''}</Text>
        <IconButton icon="chevron-right" disabled={isCurrent} onPress={() => go(1)} />
      </View>

      <Panel>
        <PanelHeader title="Highlights" subtitle={data.partial ? 'Compared with the same days last month' : 'Compared with the month before'} icon="star-four-points-outline" color={chart.series[3]} />
        {data.highlights.length ? (
          <View style={{gap: 8}}>
            {data.highlights.map((h) => (
              <View key={h} style={{flexDirection: 'row', gap: 8}}>
                <Text style={{color: chart.series[3]}}>•</Text>
                <Text variant="bodyMedium" style={{color: chart.inkPrimary, flex: 1}}>{h}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{color: chart.inkMuted}}>Not enough data to compare months yet.</Text>
        )}
        {data.strainDays > 0 && (
          <Text variant="bodySmall" style={{color: chart.status.warning, marginTop: 10}}>{data.strainDays} {data.strainDays === 1 ? 'day' : 'days'} with signs of strain.</Text>
        )}
      </Panel>

      <CollapsiblePanel id="report.calendar" title="Readiness calendar" icon="calendar-month-outline" color={chart.category.recovery} defaultOpen>
        <View style={{flexDirection: 'row', marginBottom: 4}}>
          {WEEKDAYS.map((d) => <Text key={d} variant="labelSmall" style={{flex: 1, textAlign: 'center', color: chart.inkMuted}}>{d[0]}</Text>)}
        </View>
        <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
          {cells.map((c, i) => (
            <View key={i} style={{width: `${100 / 7}%`, aspectRatio: 1, padding: 2}}>
              {c && (
                <View style={{flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.readiness != null ? `${scoreColor(scoreLabel(c.readiness), chart.status)}${c.readiness >= 85 ? 'cc' : '77'}` : chart.grid}}>
                  <Text variant="labelSmall" style={{color: chart.inkPrimary}}>{parseIsoDate(c.date).getDate()}</Text>
                  {c.readiness != null && <Text variant="labelSmall" style={{color: chart.inkPrimary, fontWeight: '700', fontSize: 10}}>{c.readiness}</Text>}
                </View>
              )}
            </View>
          ))}
        </View>
        {data.best && data.worst && data.best.date !== data.worst.date && (
          <Text variant="bodySmall" style={{color: chart.inkSecondary, marginTop: 8}}>
            Best day {parseIsoDate(data.best.date).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric'})} ({data.best.value}) · toughest {parseIsoDate(data.worst.date).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric'})} ({data.worst.value})
          </Text>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel id="report.weekday" title="By day of the week" summary="Steps, readiness and sleep by weekday" icon="calendar-week" color={chart.series[0]}>
        <View style={{gap: 6}}>
          {WEEKDAYS.map((d, i) => (
            <View key={d} style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <Text variant="labelMedium" style={{width: 32, color: chart.inkSecondary}}>{d}</Text>
              <View style={{flex: 1, height: 8, borderRadius: 4, backgroundColor: chart.grid, overflow: 'hidden'}}>
                <View style={{width: `${((data.weekday.steps[i] ?? 0) / maxSteps) * 100}%`, height: '100%', backgroundColor: chart.category.activity, borderRadius: 4}} />
              </View>
              <Text variant="labelSmall" style={{width: 52, textAlign: 'right', color: chart.inkSecondary}}>{data.weekday.steps[i] != null ? data.weekday.steps[i]!.toLocaleString() : '–'}</Text>
              <Text variant="labelSmall" style={{width: 48, textAlign: 'right', color: chart.inkPrimary}}>R {data.weekday.readiness[i] ?? '–'}</Text>
              <Text variant="labelSmall" style={{width: 44, textAlign: 'right', color: chart.inkPrimary}}>S {data.weekday.sleep[i] ?? '–'}</Text>
            </View>
          ))}
        </View>
        <Text variant="labelSmall" style={{color: chart.inkMuted, marginTop: 8}}>Bars: steps · R: readiness · S: sleep score</Text>
      </CollapsiblePanel>

      <CollapsiblePanel id="report.numbers" title="The numbers" summary="This month against last month" icon="table" color={chart.series[2]}>
        <View style={{flexDirection: 'row', marginBottom: 4}}>
          <View style={{flex: 1}} />
          <Text variant="labelSmall" style={{width: 80, textAlign: 'right', color: chart.inkMuted}}>This month</Text>
          <Text variant="labelSmall" style={{width: 80, textAlign: 'right', color: chart.inkMuted}}>Last month</Text>
        </View>
        {rows(data.cur, data.prev).map((r) => <Compare key={r.label} label={r.label} cur={r.cur} prev={r.prev} fmt={r.fmt} higherIsBetter={r.hib} />)}
      </CollapsiblePanel>

      {data.tags.length > 0 && (
        <CollapsiblePanel id="report.tags" title="Tags" summary={data.tags.map((t) => `${t.name} ${formatTagAmount(t.total, t.unit)}`).join(' · ')} icon="tag-multiple-outline" color={chart.series[1]}>
          {data.tags.map((t) => (
            <View key={t.tagId} style={{flexDirection: 'row', paddingVertical: 3}}>
              <Text variant="bodySmall" style={{flex: 1, color: chart.inkSecondary}}>{t.name} <Text style={{color: chart.inkMuted}}>({t.days} days)</Text></Text>
              <Text variant="bodySmall" style={{width: 80, textAlign: 'right', color: chart.inkPrimary, fontWeight: '600'}}>{formatTagAmount(t.total, t.unit)}</Text>
              <Text variant="bodySmall" style={{width: 80, textAlign: 'right', color: chart.inkSecondary}}>{formatTagAmount(t.prevTotal, t.unit)}</Text>
            </View>
          ))}
        </CollapsiblePanel>
      )}

      {(data.helps.length > 0 || data.hurts.length > 0) && (
        <CollapsiblePanel id="report.patterns" title="Your clearest patterns" summary={`${data.helps.length + data.hurts.length} patterns this month`} icon="chart-scatter-plot" color={chart.series[6]}>
          <View style={{gap: 12}}>
            {[...data.helps, ...data.hurts].map((e) => <EffectRow key={`${e.factorId}-${e.targetKey}`} effect={e} onPress={() => openFactor(e)} />)}
          </View>
        </CollapsiblePanel>
      )}
    </ScrollView>
  );
}
