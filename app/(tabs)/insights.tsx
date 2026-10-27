import {useState} from 'react';
import {RefreshControl, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {Button, Text} from 'react-native-paper';
import InsightCard from '@/components/InsightCard';
import ExperimentSummary from '@/components/experiments/ExperimentSummary';
import {EffectRow, openFactor} from '@/components/effects/EffectList';
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
  const helps = topEffects(effects, {good: true, limit: showAll ? undefined : 4});
  const hurts = topEffects(effects, {good: false, limit: showAll ? undefined : 4});
  const learning = (report?.effects.progress ?? []).filter((p) => p.withNeeded + p.withoutNeeded > 0);
  const factorName = (id: string) => report?.effects.factors.find((f) => f.id === id)?.name ?? id;
  const overlaps = report?.effects.overlaps ?? [];
  const experiments = report?.experiments ?? [];
  const thisMonth = monthStart(today());
  const months = [0, -1, -2, -3].map((n) => shiftMonth(thisMonth, n));

  return (
    <ScrollView
      style={{backgroundColor: chart.page}}
      contentContainerStyle={{paddingTop: 4, paddingBottom: 32}}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} />}
    >
      <SectionHeader title="What helps you" />
      <Panel>
        {helps.length ? (
          <View style={{gap: 14}}>{helps.map((e) => <EffectRow key={`${e.factorId}-${e.targetKey}`} effect={e} onPress={() => openFactor(e)} />)}</View>
        ) : (
          <Text style={{color: chart.inkMuted}}>Nothing clear yet. Patterns appear as you log tags and wear your watch for a few weeks.</Text>
        )}
      </Panel>

      <SectionHeader title="What holds you back" />
      <Panel>
        {hurts.length ? (
          <View style={{gap: 14}}>{hurts.map((e) => <EffectRow key={`${e.factorId}-${e.targetKey}`} effect={e} onPress={() => openFactor(e)} />)}</View>
        ) : (
          <Text style={{color: chart.inkMuted}}>Nothing clear yet.</Text>
        )}
      </Panel>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: -4}}>
        <Text variant="labelSmall" style={{color: chart.inkMuted, flex: 1}}>
          Includes your tags and patterns found automatically, like late nights and workout days. Tap one for details.
        </Text>
        <Button compact onPress={() => setShowAll(!showAll)}>{showAll ? 'Fewer' : 'Show all'}</Button>
      </View>

      {(learning.length > 0 || overlaps.length > 0) && (
        <Panel style={{marginTop: 12}}>
          <PanelHeader title="Still learning" icon="school-outline" color={chart.series[3]} />
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
        </Panel>
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

      {(report?.insights.length ?? 0) > 0 && (
        <>
          <SectionHeader title="All current insights" />
          {report!.insights.map((i) => <InsightCard key={i.id} insight={i} />)}
        </>
      )}
    </ScrollView>
  );
}
