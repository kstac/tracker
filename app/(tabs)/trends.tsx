import {useMemo, useState} from 'react';
import {RefreshControl, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {Chip, Text} from 'react-native-paper';
import {DailyLoadChart} from '@/components/training/LoadCharts';
import MetricCard from '@/components/MetricCard';
import ScoreCard from '@/components/scores/ScoreCard';
import WeeklySummaryPanel from '@/components/scores/WeeklySummaryPanel';
import {SCORE_KINDS} from '@/components/scores/defs';
import {useScoreHistory} from '@/components/scores/useScoreHistory';
import {lastCompletedWeek, weekToDate} from '@/insights';
import {today} from '@/lib/dates';
import SleepStagesChart from '@/components/charts/SleepStagesChart';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {CATEGORY_ICONS, CATEGORY_LABELS, MetricDef, METRICS, MetricCategory} from '@/metrics/registry';
import ManualValueDialog from '@/components/ManualValueDialog';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MetricCategory[];

type TrendsView = 'scores' | MetricCategory;

export default function TrendsScreen() {
  const {chart, colors} = useAppTheme();
  const {daily, sleep, tags, tagEntries, settings, report, syncing, sync, setManualValue} = useAppData();
  const [adding, setAdding] = useState<MetricDef | null>(null);
  const [category, setCategory] = useState<TrendsView>('scores');
  const history = useScoreHistory();
  const weekly = useMemo(
    () => {
      if (category !== 'scores') return null;
      const input = {today: today(), daily, sleep, tags, tagEntries, settings};
      return {current: weekToDate(input, input.today), previous: lastCompletedWeek(input, input.today)};
    },
    [category, daily, sleep, tags, tagEntries, settings],
  );

  const metrics = METRICS.filter((m) => m.category === category && !m.hidden && (daily[m.id]?.size ?? 0) > 0);

  return (
    <ScrollView
      style={{backgroundColor: chart.page}}
      contentContainerStyle={{paddingBottom: 32}}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} />}
      stickyHeaderIndices={[0]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{backgroundColor: chart.page}}
        contentContainerStyle={{gap: 8, paddingHorizontal: 16, paddingVertical: 12}}
      >
        <Chip
          icon="star-four-points-outline"
          selected={category === 'scores'}
          showSelectedOverlay
          onPress={() => setCategory('scores')}
          style={category === 'scores' ? {backgroundColor: `${colors.primary}26`} : undefined}
        >
          Scores
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            icon={CATEGORY_ICONS[c]}
            selected={c === category}
            showSelectedOverlay
            onPress={() => setCategory(c)}
            style={c === category ? {backgroundColor: `${chart.category[c]}26`} : undefined}
          >
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </ScrollView>

      {category === 'activity' && report && report.load.days.length > 0 && (
        <Panel onPress={() => router.push('/training')}>
          <PanelHeader title="Training load" subtitle={report.load.statusText} icon="run-fast" color={chart.category.activity} />
          <DailyLoadChart days={report.load.days.slice(-30)} height={120} />
        </Panel>
      )}

      {category === 'body' && (
        <Panel>
          <PanelHeader title="Log a measurement" subtitle="Weight, body fat or blood pressure from a scale or cuff" icon="clipboard-plus-outline" color={chart.category.body} />
          <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
            {METRICS.filter((m) => m.manualEntry).map((m) => (
              <Chip key={m.id} icon={m.icon} onPress={() => setAdding(m)}>{m.label}</Chip>
            ))}
          </View>
        </Panel>
      )}

      {category === 'feel' && metrics.length === 0 && (
        <Panel>
          <Text style={{color: chart.inkMuted}}>Do the morning check-in on Today or in the Journal to see how your energy, mood and soreness trend.</Text>
        </Panel>
      )}

      {category === 'sleep' && sleep.length > 0 && (
        <Panel>
          <PanelHeader title="Sleep stages" subtitle="Last 14 nights" icon="chart-bar-stacked" color={chart.category.sleep} />
          <SleepStagesChart nights={sleep.slice(-14)} />
        </Panel>
      )}

      {category === 'scores' ? (
        <>
          {weekly && <WeeklySummaryPanel current={weekly.current} previous={weekly.previous} />}
          {SCORE_KINDS.map((k) => <ScoreCard key={k} kind={k} days={history.days} />)}
        </>
      ) : metrics.length === 0 ? category === 'feel' ? null : (
        <Panel>
          <Text style={{color: chart.inkMuted}}>No {CATEGORY_LABELS[category].toLowerCase()} data yet.</Text>
        </Panel>
      ) : (
        metrics.map((m) => <MetricCard key={m.id} def={m} daily={daily} />)
      )}
      <ManualValueDialog
        def={adding}
        onDismiss={() => setAdding(null)}
        onSubmit={async (date, value) => {
          const def = adding;
          setAdding(null);
          if (def) await setManualValue(def.id, date, value);
        }}
      />
    </ScrollView>
  );
}
