import {ScrollView} from 'react-native';
import {Stack, useLocalSearchParams} from 'expo-router';
import {Text} from 'react-native-paper';
import {EffectList} from '@/components/effects/EffectList';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

export default function FactorScreen() {
  const {id} = useLocalSearchParams<{id: string}>();
  const {chart} = useAppTheme();
  const {report} = useAppData();
  const factor = report?.effects.factors.find((f) => f.id === id);
  const effects = (report?.effects.effects ?? []).filter((e) => e.factorId === id);

  if (!factor) return <Text style={{padding: 16}}>Not enough data for this pattern yet.</Text>;
  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingTop: 12, paddingBottom: 32}}>
      <Stack.Screen options={{title: factor.name}} />
      <Panel>
        <PanelHeader title={factor.name} subtitle={factor.description} icon="auto-fix" color={chart.series[6]} />
        <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
          Found automatically from your data: {factor.present.size} days like this out of {factor.eligible.size} in the last year.
        </Text>
      </Panel>
      <Panel>
        <PanelHeader title="How it affects you" icon="chart-scatter-plot" color={chart.series[1]} />
        <EffectList effects={effects} />
      </Panel>
    </ScrollView>
  );
}
