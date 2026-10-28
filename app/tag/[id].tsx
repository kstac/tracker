import {useMemo, useState} from 'react';
import {Alert, ScrollView, View} from 'react-native';
import {router, Stack, useLocalSearchParams} from 'expo-router';
import {Button, SegmentedButtons, Text} from 'react-native-paper';
import TagEditDialog from '@/components/TagEditDialog';
import LimitBar, {limitColor} from '@/components/tags/LimitBar';
import TagTotalsChart, {rangeStart} from '@/components/tags/TagTotalsChart';
import TagCalendar from '@/components/tags/TagCalendar';
import TrendBadge from '@/components/tags/TrendBadge';
import CollapsiblePanel from '@/components/ui/CollapsiblePanel';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {EffectList} from '@/components/effects/EffectList';
import {computeTagStats, formatTagAmount, monthlyTotals, weeklyTotals} from '@/insights/tagStats';
import {parseIsoDate, today} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
type Range = '3m' | '1y' | 'all';

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

const days = (n: number | null) => (n == null ? '–' : `${n} ${n === 1 ? 'day' : 'days'}`);

export default function TagScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const {chart} = useAppTheme();
  const {allTags: tags, tagEntries, report, updateTag, deleteTag, setTagArchived} = useAppData();
  const [editing, setEditing] = useState(false);
  const [range, setRange] = useState<Range>('1y');
  const end = today();
  const tagIndex = tags.findIndex((t) => t.id === id);
  const tag = tagIndex >= 0 ? tags[tagIndex] : null;

  const entries = useMemo(
    () => tagEntries.filter((e) => e.tagId === id && e.value > 0).sort((a, b) => b.date.localeCompare(a.date)),
    [tagEntries, id],
  );
  const stats = useMemo(() => computeTagStats(entries, end, tag?.weeklyLimit ?? null), [entries, end, tag?.weeklyLimit]);
  const bucket = range === 'all' ? 'month' : 'week';
  const periods = useMemo(() => {
    const from = rangeStart(range, end, stats.firstDate);
    return bucket === 'month' ? monthlyTotals(entries, from, end) : weeklyTotals(entries, from, end);
  }, [entries, range, end, stats.firstDate, bucket]);

  if (!tag) return <Text style={{padding: 16}}>Tag not found</Text>;

  const color = chart.series[tagIndex % chart.series.length];
  const effects = (report?.effects.effects ?? []).filter((e) => e.factorId === id);
  const progress = report?.effects.progress.find((p) => p.factorId === id) ?? null;
  const overlaps = (report?.effects.overlaps ?? []).filter((o) => o.a === id || o.b === id);
  const amount = (v: number) => formatTagAmount(Math.round(v * 10) / 10, tag.unit);
  const fmtDate = (d: string) => parseIsoDate(d).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'});
  const fraction = stats.thisWeek.fraction;
  const maxWeekday = Math.max(...stats.weekdayAverages, 0.0001);

  const confirmDelete = () =>
    Alert.alert('Delete tag?', `"${tag.name}" and its ${entries.length} logged days will be removed.`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteTag(tag.id);
        router.back();
      }},
    ]);

  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingTop: 12, paddingBottom: 32}}>
      <Stack.Screen options={{title: tag.name}} />
      {tag.archived && (
        <Panel>
          <Text style={{color: chart.inkSecondary}}>Archived. It&apos;s hidden from logging, but its history and patterns are kept.</Text>
        </Panel>
      )}

      <Panel style={{gap: 16}}>
        <View style={{gap: 6}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'}}>
            <View>
              <Text variant="labelMedium" style={{color: chart.inkSecondary}}>This week</Text>
              <Text variant="headlineSmall" style={{color: fraction != null ? limitColor(fraction, chart.status, chart.inkPrimary) : chart.inkPrimary, fontWeight: '700'}}>
                {tag.weeklyLimit != null ? `${amount(stats.thisWeek.total)} / ${amount(tag.weeklyLimit)}` : amount(stats.thisWeek.total)}
              </Text>
            </View>
            {stats.fourWeekChange != null && <TrendBadge change={stats.fourWeekChange} unit={tag.unit} reduceIsGood={tag.weeklyLimit != null} />}
          </View>
          {fraction != null && <LimitBar fraction={fraction} color={color} height={6} />}
          {fraction != null && fraction > 1 && (
            <Text variant="labelSmall" style={{color: chart.status.critical}}>Over your weekly limit by {amount(stats.thisWeek.total - tag.weeklyLimit!)}</Text>
          )}
        </View>
        <View style={{flexDirection: 'row'}}>
          <Stat label="Days without" value={days(stats.currentStreakWithout)} sub={stats.longestStreakWithout != null ? `Longest ${days(stats.longestStreakWithout)}` : undefined} />
          <Stat label="Weekly average" value={amount(stats.fourWeekAvg)} sub={stats.previousFourWeekAvg != null ? `Prior 4 weeks ${amount(stats.previousFourWeekAvg)}` : 'Last 4 weeks'} />
        </View>
        <Text variant="labelSmall" style={{color: chart.inkMuted}}>
          {stats.daysLogged} days logged · {amount(stats.total)} in total{stats.firstDate ? ` · since ${fmtDate(stats.firstDate)}` : ''}
        </Text>
      </Panel>

      <Panel>
        <PanelHeader title={bucket === 'week' ? 'Weekly totals' : 'Monthly totals'} icon="chart-bar" color={color} />
        <SegmentedButtons
          value={range}
          onValueChange={(v) => setRange(v as Range)}
          density="small"
          style={{marginBottom: 12}}
          buttons={[
            {value: '3m', label: '3M'},
            {value: '1y', label: '1Y'},
            {value: 'all', label: 'All'},
          ]}
        />
        <TagTotalsChart periods={periods} bucket={bucket} unit={tag.unit} color={color} weeklyLimit={tag.weeklyLimit} />
      </Panel>

      {stats.daysLogged > 0 && (
        <CollapsiblePanel
          id="tag.weekday"
          title="By day of week"
          subtitle="Average per day since you started logging"
          summary={`Most on ${WEEKDAYS[stats.weekdayAverages.indexOf(maxWeekday)] ?? '–'}`}
          icon="calendar-week"
          color={color}
        >
          <View style={{gap: 8}}>
            {WEEKDAYS.map((d, i) => (
              <View key={d} style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <Text variant="labelMedium" style={{color: chart.inkSecondary, width: 32}}>{d}</Text>
                <View style={{flex: 1, height: 8, borderRadius: 4, backgroundColor: chart.grid, overflow: 'hidden'}}>
                  <View style={{width: `${(stats.weekdayAverages[i] / maxWeekday) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: color}} />
                </View>
                <Text variant="labelMedium" style={{color: chart.inkPrimary, width: 56, textAlign: 'right'}}>{amount(stats.weekdayAverages[i])}</Text>
              </View>
            ))}
          </View>
        </CollapsiblePanel>
      )}

      <Panel>
        <PanelHeader title="How it affects you" subtitle="Compared with days you didn't log it" icon="chart-scatter-plot" color={chart.series[1]} />
        <EffectList effects={effects} progress={progress} factorName={tag.name} />
        {overlaps.map((o) => (
          <Text key={`${o.a}-${o.b}`} variant="bodySmall" style={{color: chart.status.warning, marginTop: 8}}>
            Often logged on the same days as {o.a === id ? o.bName : o.aName} ({Math.round(o.jaccard * 100)}% overlap).
          </Text>
        ))}
      </Panel>

      <Panel>
        <PanelHeader title={`History · ${entries.length} days`} icon="calendar-month-outline" color={color} />
        <TagCalendar entries={entries} end={end} firstDate={stats.firstDate} color={color} />
      </Panel>

      <View style={{flexDirection: 'row', gap: 8, marginHorizontal: 16}}>
        <Button mode="outlined" icon="pencil-outline" onPress={() => setEditing(true)}>Edit</Button>
        <Button mode="outlined" icon={tag.archived ? 'archive-arrow-up-outline' : 'archive-outline'} onPress={() => setTagArchived(tag.id, !tag.archived)}>
          {tag.archived ? 'Restore' : 'Archive'}
        </Button>
        <Button mode="outlined" icon="trash-can-outline" textColor={chart.status.critical} onPress={confirmDelete}>Delete</Button>
      </View>
      <TagEditDialog
        visible={editing}
        title="Edit tag"
        initial={{name: tag.name, unit: tag.unit, weeklyLimit: tag.weeklyLimit}}
        onDismiss={() => setEditing(false)}
        onSubmit={async (update) => {
          setEditing(false);
          await updateTag(tag.id, update);
        }}
      />
    </ScrollView>
  );
}
