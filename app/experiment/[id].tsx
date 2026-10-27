import {Alert, ScrollView, View} from 'react-native';
import {router, Stack, useLocalSearchParams} from 'expo-router';
import {Button, Text} from 'react-native-paper';
import {formatTargetValue} from '@/components/effects/EffectList';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {parseIsoDate, today} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const fmt = (d: string) => parseIsoDate(d).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'});
const PREDICTION = {better: 'better', same: 'no change', worse: 'worse'};

export default function ExperimentScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const {chart} = useAppTheme();
  const {report, tags, endExperiment, deleteExperiment} = useAppData();
  const result = report?.experiments.find((r) => r.experiment.id === id);
  if (!result) return <Text style={{padding: 16}}>Experiment not found</Text>;
  const e = result.experiment;
  const tag = tags.find((t) => t.id === e.tagId);
  const fraction = result.state === 'upcoming' ? 0 : Math.min(1, result.daysElapsed / e.days);

  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingTop: 12, paddingBottom: 32}}>
      <Stack.Screen options={{title: e.name}} />
      <Panel style={{gap: 8}}>
        <PanelHeader
          title={result.state === 'running' ? `Day ${result.daysElapsed} of ${e.days}` : result.state === 'upcoming' ? `Starts ${fmt(e.start)}` : 'Finished'}
          subtitle={`${fmt(e.start)} – ${fmt(result.end)}${tag ? ` · ${e.mode === 'avoid' ? 'avoiding' : 'doing'} ${tag.name}` : ''}`}
          icon="flask-outline"
          color={chart.series[0]}
        />
        <View style={{height: 8, borderRadius: 4, backgroundColor: chart.grid, overflow: 'hidden'}}>
          <View style={{width: `${fraction * 100}%`, height: '100%', backgroundColor: chart.series[0]}} />
        </View>
        {result.compliance && (
          <Text variant="bodySmall" style={{color: chart.inkSecondary}}>Kept to it on {result.compliance.kept} of {result.compliance.logged} days (from your {tag?.name ?? 'tag'} log).</Text>
        )}
        {e.prediction && (
          <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
            You predicted {PREDICTION[e.prediction]}.{result.predictionMatched != null ? (result.predictionMatched ? ' You were right.' : ' The result was different.') : ''}
          </Text>
        )}
        {result.verdict && <Text variant="bodyLarge" style={{color: chart.inkPrimary, fontWeight: '600', marginTop: 4}}>{result.verdict}</Text>}
      </Panel>

      <Panel>
        <View style={{flexDirection: 'row', marginBottom: 6}}>
          <Text variant="titleMedium" style={{flex: 1, color: chart.inkPrimary, fontWeight: '600'}}>Results</Text>
          <Text variant="labelSmall" style={{width: 64, textAlign: 'right', color: chart.inkMuted}}>Before</Text>
          <Text variant="labelSmall" style={{width: 64, textAlign: 'right', color: chart.inkMuted}}>During</Text>
        </View>
        <View style={{gap: 10}}>
          {result.metrics.map((m) => (
            <View key={m.key}>
              <View style={{flexDirection: 'row'}}>
                <Text variant="bodyMedium" style={{flex: 1, color: chart.inkPrimary}}>{m.label}</Text>
                <Text variant="bodyMedium" style={{width: 64, textAlign: 'right', color: chart.inkSecondary}}>{m.before == null ? '–' : formatTargetValue(m.metric, m.before)}</Text>
                <Text variant="bodyMedium" style={{width: 64, textAlign: 'right', color: m.improved === true ? chart.deltaGood : m.improved === false ? chart.status.critical : chart.inkPrimary, fontWeight: '600'}}>
                  {m.during == null ? '–' : formatTargetValue(m.metric, m.during)}
                </Text>
              </View>
              <Text variant="bodySmall" style={{color: chart.inkMuted}}>{m.text} · {m.nDuring} vs {m.nBefore} days</Text>
            </View>
          ))}
        </View>
        <Text variant="bodySmall" style={{color: chart.inkMuted, marginTop: 12}}>
          Changes are marked better or worse only when they are unlikely to be normal day-to-day variation.
        </Text>
      </Panel>

      <View style={{flexDirection: 'row', gap: 8, marginHorizontal: 16}}>
        {result.state === 'running' && <Button mode="outlined" onPress={() => endExperiment(e.id, today())}>End now</Button>}
        <Button
          mode="outlined"
          textColor={chart.status.critical}
          onPress={() =>
            Alert.alert('Delete experiment?', undefined, [
              {text: 'Cancel', style: 'cancel'},
              {text: 'Delete', style: 'destructive', onPress: async () => { await deleteExperiment(e.id); router.back(); }},
            ])
          }
        >
          Delete
        </Button>
      </View>
    </ScrollView>
  );
}
