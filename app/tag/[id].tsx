import {useMemo, useState} from 'react';
import {Alert, ScrollView, View} from 'react-native';
import {router, Stack, useLocalSearchParams} from 'expo-router';
import {Button, DataTable, SegmentedButtons, Text} from 'react-native-paper';
import TagEditDialog from '@/components/TagEditDialog';
import LimitBar, {limitColor} from '@/components/tags/LimitBar';
import TagTotalsChart, {rangeStart} from '@/components/tags/TagTotalsChart';
import TrendBadge from '@/components/tags/TrendBadge';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {computeTagStats, formatTagAmount, monthlyTotals, weeklyTotals} from '@/insights/tagStats';
import {parseIsoDate, today} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const PAGE = 30;
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
  const {tags, tagEntries, report, updateTag, deleteTag} = useAppData();
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(PAGE);
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
  const effects = (report?.tagEffects ?? []).filter((e) => e.tagId === id);
  const amount = (v: number) => formatTagAmount(Math.round(v * 10) / 10, tag.unit);
  const fmtDate = (d: string, weekday = false) =>
    parseIsoDate(d).toLocaleDateString(undefined, {weekday: weekday ? 'short' : undefined, day: 'numeric', month: 'short', year: 'numeric'});
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
        <View style={{flexDirection: 'row'}}>
          <Stat label="Days logged" value={String(stats.daysLogged)} sub={`Total ${amount(stats.total)}`} />
          <Stat label="First logged" value={stats.firstDate ? fmtDate(stats.firstDate) : '–'} />
        </View>
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
        <Panel>
          <PanelHeader title="By day of week" subtitle="Average per day since you started logging" icon="calendar-week" color={color} />
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
        </Panel>
      )}

      <Panel>
        <PanelHeader title="How it lines up with your data" icon="chart-scatter-plot" color={chart.series[1]} />
        <View style={{gap: 12}}>
          {effects.length === 0 ? (
            <Text style={{color: chart.inkMuted}}>
              No clear pattern yet. This needs at least 5 days with and 5 days without the tag while your watch was recording, and only differences that are big enough are shown.
            </Text>
          ) : (
            effects.map((e) => (
              <View key={`${e.metric}-${e.lag}`}>
                <Text variant="bodyMedium" style={{color: chart.inkPrimary}}>{e.summary}</Text>
                <Text variant="bodySmall" style={{color: chart.inkMuted}}>
                  {e.metricLabel} · effect size {Math.abs(e.cohensD).toFixed(1)} · {e.nTagged} vs {e.nUntagged} days
                </Text>
              </View>
            ))
          )}
          <Text variant="bodySmall" style={{color: chart.inkMuted}}>These are correlations, not proof that the tag causes the change.</Text>
        </View>
      </Panel>

      <Panel padded={false}>
        <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '600', padding: 16, paddingBottom: 4}}>
          History · {entries.length} days
        </Text>
        <DataTable>
          {entries.slice(0, shown).map((e) => (
            <DataTable.Row key={e.date}>
              <DataTable.Cell>{fmtDate(e.date, true)}</DataTable.Cell>
              <DataTable.Cell numeric>{amount(e.value)}</DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable>
        {entries.length > shown && (
          <Button onPress={() => setShown(shown + PAGE * 3)} style={{margin: 8}}>
            Show older ({entries.length - shown} more)
          </Button>
        )}
      </Panel>

      <View style={{flexDirection: 'row', gap: 8, marginHorizontal: 16}}>
        <Button mode="outlined" icon="pencil-outline" onPress={() => setEditing(true)}>Edit</Button>
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
