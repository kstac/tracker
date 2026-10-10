import {useState} from 'react';
import {Alert, ScrollView, View} from 'react-native';
import {router, Stack, useLocalSearchParams} from 'expo-router';
import {Button, DataTable, Text} from 'react-native-paper';
import TagNameDialog from '@/components/TagNameDialog';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {addDays, daysBetween, parseIsoDate, today} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const PAGE = 30;

function Stat({label, value}: {label: string; value: string}) {
  const {chart} = useAppTheme();
  return (
    <View style={{flex: 1}}>
      <Text variant="labelMedium" style={{color: chart.inkSecondary}}>{label}</Text>
      <Text variant="titleLarge" style={{color: chart.inkPrimary, fontWeight: '700'}}>{value}</Text>
    </View>
  );
}

export default function TagScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const {chart} = useAppTheme();
  const {tags, tagEntries, report, renameTag, deleteTag} = useAppData();
  const [renaming, setRenaming] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const tag = tags.find((t) => t.id === id);
  if (!tag) return <Text style={{padding: 16}}>Tag not found</Text>;

  const entries = tagEntries.filter((e) => e.tagId === id && e.value > 0).sort((a, b) => b.date.localeCompare(a.date));
  const end = today();
  const in30 = entries.filter((e) => e.date > addDays(end, -30));
  const effects = (report?.tagEffects ?? []).filter((e) => e.tagId === id);
  const first = entries.length ? entries[entries.length - 1].date : null;
  const fmtDate = (d: string, weekday = false) =>
    parseIsoDate(d).toLocaleDateString(undefined, {weekday: weekday ? 'short' : undefined, day: 'numeric', month: 'short', year: 'numeric'});

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
        <View style={{flexDirection: 'row'}}>
          <Stat label="Last 30 days" value={`${in30.length} days`} />
          <Stat label="Since last" value={entries.length ? `${daysBetween(entries[0].date, end)} days` : '–'} />
        </View>
        <View style={{flexDirection: 'row'}}>
          <Stat label="Days logged" value={String(entries.length)} />
          <Stat label="First logged" value={first ? fmtDate(first) : '–'} />
        </View>
      </Panel>

      <Panel>
        <PanelHeader title="How it lines up with your data" icon="chart-scatter-plot" color={chart.series[1]} />
        <View style={{gap: 12}}>
          {effects.length === 0 ? (
            <Text style={{color: chart.inkMuted}}>
              No clear pattern yet. This needs at least 5 days with and 5 days without the tag, and only differences that are big enough are shown.
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
              <DataTable.Cell numeric>{e.value}</DataTable.Cell>
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
        <Button mode="outlined" icon="pencil-outline" onPress={() => setRenaming(true)}>Rename</Button>
        <Button mode="outlined" icon="trash-can-outline" textColor={chart.status.critical} onPress={confirmDelete}>Delete</Button>
      </View>
      <TagNameDialog
        visible={renaming}
        title="Rename tag"
        initial={tag.name}
        onDismiss={() => setRenaming(false)}
        onSubmit={async (name) => {
          setRenaming(false);
          await renameTag(tag.id, name);
        }}
      />
    </ScrollView>
  );
}
