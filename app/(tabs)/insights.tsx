import {useState} from 'react';
import {RefreshControl, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {Button, Text} from 'react-native-paper';
import ExperimentSummary from '@/components/experiments/ExperimentSummary';
import {EffectRow, openFactor} from '@/components/effects/EffectList';
import CollapsiblePanel from '@/components/ui/CollapsiblePanel';
import {Panel, PanelHeader, SectionHeader} from '@/components/ui/Panel';
import {monthLabel, shiftMonth, topEffects} from '@/insights';
import {monthStart} from '@/insights/tagStats';
import {today} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

export default function InsightsScreen() {
  const {chart, colors} = useAppTheme();
  const {report, syncing, sync} = useAppData();
  const [showAll, setShowAll] = useState(false);
  const effects = report?.effects.effects ?? [];
  const helps = topEffects(effects, {good: true, actionable: true, limit: showAll ? undefined : 4});
  const hurts = topEffects(effects, {good: false, actionable: true, limit: showAll ? undefined : 4});
  const other = [...topEffects(effects, {actionable: false}), ...topEffects(effects, {actionable: true}).filter((e) => e.good == null)];
  const otherNames = [...new Set(other.map((e) => e.factorName.toLowerCase()))];
  const cards = (report?.insights ?? []).filter((i) => i.id !== 'top_effect');
  const learning = (report?.effects.progress ?? []).filter((p) => p.withNeeded + p.withoutNeeded > 0);
  const factorName = (id: string) => report?.effects.factors.find((f) => f.id === id)?.name ?? id;
  const overlaps = report?.effects.overlaps ?? [];
  const experiments = report?.experiments ?? [];
  const thisMonth = monthStart(today());
  const months = [0, -1, -2].map((n) => shiftMonth(thisMonth, n));

  return (
    <ScrollView
      style={{backgroundColor: chart.page}}
      contentContainerStyle={{paddingTop: 4, paddingBottom: 32}}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} />}
    >
      <SectionHeader title="What helps you" />
      <Panel>
        {helps.length ? (
          <View style={{gap: 14}}>{helps.map((e) => <EffectRow key={`${e.factorId}-${e.targetKey}`} effect={e} compact onPress={() => openFactor(e)} />)}</View>
        ) : (
          <Text style={{color: chart.inkMuted}}>Nothing clear yet. Patterns appear as you log tags and wear your watch for a few weeks.</Text>
        )}
      </Panel>

      <SectionHeader title="What holds you back" />
      <Panel>
        {hurts.length ? (
          <View style={{gap: 14}}>{hurts.map((e) => <EffectRow key={`${e.factorId}-${e.targetKey}`} effect={e} compact onPress={() => openFactor(e)} />)}</View>
        ) : (
          <Text style={{color: chart.inkMuted}}>Nothing clear yet.</Text>
        )}
      </Panel>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: -4}}>
        <Text variant="labelSmall" style={{color: chart.inkMuted, flex: 1}}>
          Your tags and habits like late nights and workouts. Tap one for details.
        </Text>
        <Button compact onPress={() => setShowAll(!showAll)}>{showAll ? 'Fewer' : 'Show all'}</Button>
      </View>

      {other.length > 0 && (
        <CollapsiblePanel
          id="insights.other"
          title="Other patterns we noticed"
          summary={`${other.length} ${other.length === 1 ? 'pattern' : 'patterns'} about ${otherNames.slice(0, 2).join(' and ')}${otherNames.length > 2 ? ' and more' : ''}`}
          icon="chart-scatter-plot"
          color={chart.series[1]}
          subtitle="Things that line up with your data but aren't choices you make"
          style={{marginTop: 12}}
        >
          <View style={{gap: 14}}>{other.map((e) => <EffectRow key={`${e.factorId}-${e.targetKey}`} effect={e} compact onPress={() => openFactor(e)} />)}</View>
        </CollapsiblePanel>
      )}

      {(learning.length > 0 || overlaps.length > 0) && (
        <CollapsiblePanel
          id="insights.learning"
          title="Still learning"
          summary={[
            learning.length ? `${learning.length} ${learning.length === 1 ? 'tag needs' : 'tags need'} more days` : null,
            overlaps.length ? `${overlaps.length} logged together` : null,
          ].filter(Boolean).join(' · ')}
          icon="school-outline"
          color={chart.series[3]}
          style={other.length ? undefined : {marginTop: 12}}
        >
          <View style={{gap: 6}}>
            {learning.map((p) => (
              <Text key={p.factorId} variant="bodySmall" style={{color: chart.inkSecondary}}>
                {factorName(p.factorId)}: {[p.withNeeded ? `${p.withNeeded} more days with it` : null, p.withoutNeeded ? `${p.withoutNeeded} more without` : null].filter(Boolean).join(' and ')}
              </Text>
            ))}
            {overlaps.map((o) => (
              <Text key={`${o.a}-${o.b}`} variant="bodySmall" style={{color: chart.status.warning}}>
                {o.aName} and {o.bName} are usually logged together ({Math.round(o.jaccard * 100)}% overlap), so their effects are hard to separate.
              </Text>
            ))}
          </View>
        </CollapsiblePanel>
      )}

      <SectionHeader title="Experiments" right={<Button compact icon="plus" onPress={() => router.push('/experiment/new')}>New</Button>} />
      {experiments.length === 0 ? (
        <Panel onPress={() => router.push('/experiment/new')}>
          <PanelHeader title="Test a change" subtitle="e.g. two weeks without alcohol, or a fixed bedtime" icon="flask-outline" color={colors.primary} />
          <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
            Pick a change and a few metrics, make a prediction, and the app compares the experiment with the weeks before it.
          </Text>
        </Panel>
      ) : (
        experiments.map((r) => <ExperimentSummary key={r.experiment.id} result={r} />)
      )}

      <SectionHeader title="Reports" />
      <Panel padded={false}>
        {months.map((m, i) => (
          <Button key={m} contentStyle={{justifyContent: 'flex-start'}} style={{borderRadius: 0}} icon="calendar-month-outline" onPress={() => router.push({pathname: '/report/[month]', params: {month: m}})}>
            {i === 0 ? `${monthLabel(m)} so far` : monthLabel(m)}
          </Button>
        ))}
      </Panel>

      <SectionHeader title="Explore" />
      <Panel padded={false}>
        <Button contentStyle={{justifyContent: 'flex-start'}} style={{borderRadius: 0}} icon="run-fast" onPress={() => router.push('/training')}>Training load & workouts</Button>
        <Button contentStyle={{justifyContent: 'flex-start'}} style={{borderRadius: 0}} icon="shield-check-outline" onPress={() => router.push('/body')}>Body check history</Button>
        <Button contentStyle={{justifyContent: 'flex-start'}} style={{borderRadius: 0}} icon="chat-question-outline" onPress={() => router.push('/ask')}>Ask about your data</Button>
      </Panel>

      {cards.length > 0 && (
        <CollapsiblePanel
          id="insights.cards"
          title="Insight cards"
          summary={`${cards.length} current ${cards.length === 1 ? 'insight' : 'insights'}`}
          icon="lightbulb-on-outline"
          color={colors.primary}
          style={{marginTop: 12}}
        >
          <View style={{gap: 12}}>
            {cards.map((i) => (
              <View key={i.id} style={{borderLeftWidth: 3, borderLeftColor: i.kind === 'warning' ? chart.status.serious : i.kind === 'positive' ? chart.status.good : colors.primary, paddingLeft: 10}}>
                <Text variant="titleSmall" style={{color: chart.inkPrimary, fontWeight: '600'}}>{i.title}</Text>
                <Text variant="bodySmall" style={{color: chart.inkSecondary, marginTop: 2}}>{i.body}</Text>
              </View>
            ))}
          </View>
        </CollapsiblePanel>
      )}
    </ScrollView>
  );
}
