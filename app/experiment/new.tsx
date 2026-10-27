import {useState} from 'react';
import {ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {Button, Chip, SegmentedButtons, Text, TextInput} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {DEFAULT_EXPERIMENT_METRICS, EXPERIMENT_METRICS} from '@/insights';
import {addDays, today} from '@/lib/dates';
import {ExperimentMode, Prediction} from '@/metrics/types';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const IDEAS = [
  {name: 'No alcohol', mode: 'avoid' as const, match: /alcohol|drink|beer|wine/i},
  {name: 'No caffeine after noon', mode: 'avoid' as const, match: /caffeine|coffee/i},
  {name: 'Daily meditation', mode: 'do' as const, match: /meditat|breath/i},
  {name: 'No screens in bed', mode: 'avoid' as const, match: /screen|phone/i},
];

export default function NewExperimentScreen() {
  const {chart} = useAppTheme();
  const {tags, saveExperiment} = useAppData();
  const [name, setName] = useState('');
  const [tagId, setTagId] = useState<string | null>(null);
  const [mode, setMode] = useState<ExperimentMode>('avoid');
  const [days, setDays] = useState('14');
  const [start, setStart] = useState<'today' | 'tomorrow'>('today');
  const [metrics, setMetrics] = useState<string[]>(DEFAULT_EXPERIMENT_METRICS);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const valid = name.trim() !== '' && metrics.length > 0;

  const pickIdea = (idea: (typeof IDEAS)[number]) => {
    setName(idea.name);
    setMode(idea.mode);
    const tag = tags.find((t) => idea.match.test(t.name));
    if (tag) setTagId(tag.id);
  };

  const toggleMetric = (key: string) =>
    setMetrics((m) => (m.includes(key) ? m.filter((k) => k !== key) : [...m, key]));

  const save = async () => {
    if (!valid) return;
    await saveExperiment({
      name, tagId, mode, start: start === 'today' ? today() : addDays(today(), 1), days: Number(days), prediction, metrics, endedAt: null,
    });
    router.back();
  };

  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingTop: 12, paddingBottom: 32}} keyboardShouldPersistTaps="handled">
      <Panel style={{gap: 12}}>
        <PanelHeader title="What will you change?" icon="flask-outline" color={chart.series[0]} />
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
          {IDEAS.map((i) => <Chip key={i.name} compact onPress={() => pickIdea(i)}>{i.name}</Chip>)}
        </View>
        <TextInput mode="outlined" label="Name" value={name} onChangeText={setName} placeholder="e.g. Two weeks without alcohol" />
        {tags.length > 0 && (
          <View style={{gap: 6}}>
            <Text variant="labelMedium" style={{color: chart.inkSecondary}}>Track it with a tag (optional)</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
              {tags.map((t) => (
                <Chip key={t.id} compact selected={t.id === tagId} showSelectedOverlay onPress={() => setTagId(t.id === tagId ? null : t.id)}>{t.name}</Chip>
              ))}
            </View>
          </View>
        )}
        {tagId && (
          <SegmentedButtons
            value={mode}
            onValueChange={(v) => setMode(v as ExperimentMode)}
            buttons={[{value: 'avoid', label: 'Avoid it', icon: 'cancel'}, {value: 'do', label: 'Do it daily', icon: 'check'}]}
          />
        )}
      </Panel>

      <Panel style={{gap: 12}}>
        <PanelHeader title="For how long?" icon="calendar-range" color={chart.series[3]} />
        <SegmentedButtons value={days} onValueChange={setDays} buttons={['7', '14', '21', '28'].map((d) => ({value: d, label: `${d} days`}))} density="small" />
        <SegmentedButtons
          value={start}
          onValueChange={(v) => setStart(v as 'today' | 'tomorrow')}
          buttons={[{value: 'today', label: 'Start today'}, {value: 'tomorrow', label: 'Start tomorrow'}]}
          density="small"
        />
        <Text variant="bodySmall" style={{color: chart.inkMuted}}>
          Results compare the experiment with the {Math.min(28, Math.max(14, Number(days)))} days before it. Two weeks or more gives a clearer answer.
        </Text>
      </Panel>

      <Panel style={{gap: 10}}>
        <PanelHeader title="What should it change?" subtitle="The first one you pick is the main result" icon="target" color={chart.series[1]} />
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
          {EXPERIMENT_METRICS.map((m) => (
            <Chip key={m.key} compact selected={metrics.includes(m.key)} showSelectedOverlay onPress={() => toggleMetric(m.key)}>
              {metrics.indexOf(m.key) === 0 ? `★ ${m.label}` : m.label}
            </Chip>
          ))}
        </View>
      </Panel>

      <Panel style={{gap: 10}}>
        <PanelHeader title="Your prediction" subtitle="Writing it down first keeps you honest" icon="crystal-ball" color={chart.series[6]} />
        <SegmentedButtons
          value={prediction ?? ''}
          onValueChange={(v) => setPrediction((v || null) as Prediction | null)}
          buttons={[{value: 'better', label: 'Better'}, {value: 'same', label: 'No change'}, {value: 'worse', label: 'Worse'}]}
        />
      </Panel>

      <View style={{flexDirection: 'row', justifyContent: 'flex-end', marginHorizontal: 16}}>
        <Button onPress={() => router.back()}>Cancel</Button>
        <Button mode="contained" disabled={!valid} onPress={save}>Start experiment</Button>
      </View>
    </ScrollView>
  );
}
