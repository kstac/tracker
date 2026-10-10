import {useState} from 'react';
import {Pressable, RefreshControl, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Button, Chip, Text} from 'react-native-paper';
import InsightCard from '@/components/InsightCard';
import ScoreDetails from '@/components/ScoreDetails';
import ScoreRing from '@/components/ScoreRing';
import StatTile from '@/components/StatTile';
import SyncStatus from '@/components/SyncStatus';
import {Panel, PanelHeader, SectionHeader} from '@/components/ui/Panel';
import {Score} from '@/insights';
import {formatClock, formatMinutes, minutesFromMidnight, parseIsoDate, today} from '@/lib/dates';
import {formatMetricValue} from '@/lib/format';
import {METRIC_BY_ID} from '@/metrics/registry';
import {MetricId, SleepNight} from '@/metrics/types';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

type ScoreKey = 'readiness' | 'sleep' | 'activity';
const SCORE_META: Record<ScoreKey, {title: string; icon: string}> = {
  readiness: {title: 'Readiness', icon: 'battery-heart-variant'},
  sleep: {title: 'Sleep', icon: 'power-sleep'},
  activity: {title: 'Activity', icon: 'walk'},
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function StageBar({night}: {night: SleepNight}) {
  const {chart} = useAppTheme();
  const stages = [
    {label: 'Deep', min: night.deepMin},
    {label: 'Light', min: night.lightMin},
    {label: 'REM', min: night.remMin},
    {label: 'Awake', min: night.awakeMin},
  ];
  const total = stages.reduce((a, s) => a + s.min, 0) || 1;
  return (
    <View style={{gap: 10}}>
      <View style={{flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2}}>
        {stages.map((s, i) => s.min > 0 && <View key={s.label} style={{flex: s.min / total, backgroundColor: chart.series[i]}} />)}
      </View>
      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
        {stages.map((s, i) => (
          <View key={s.label} style={{gap: 2}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
              <View style={{width: 8, height: 8, borderRadius: 2, backgroundColor: chart.series[i]}} />
              <Text variant="labelSmall" style={{color: chart.inkSecondary}}>{s.label}</Text>
            </View>
            <Text variant="labelLarge" style={{color: chart.inkPrimary}}>{formatMinutes(s.min)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function TodayScreen() {
  const {chart, colors} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {report, daily, sleep, tags, tagEntries, syncing, sync, setTagValue, loading} = useAppData();
  const [openScore, setOpenScore] = useState<ScoreKey | null>(null);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const date = today();

  const value = (metric: MetricId) => daily[metric]?.get(date) ?? null;
  const lastNight = [...sleep].reverse().find((n) => n.date <= date);
  const hasAnyData = Object.keys(daily).length > 0;
  const insights = report?.insights ?? [];
  const visibleInsights = showAllInsights ? insights : insights.slice(0, 3);

  const scores: Record<ScoreKey, Score | null> = {
    readiness: report?.readiness ?? null,
    sleep: report?.sleep ?? null,
    activity: report?.activity ?? null,
  };
  const open = openScore ? scores[openScore] : null;
  const toggle = (key: ScoreKey) => scores[key] && setOpenScore(openScore === key ? null : key);

  const tile = (metric: MetricId, label?: string) => {
    const def = METRIC_BY_ID[metric];
    return (
      <StatTile
        key={metric}
        label={label ?? def.label}
        value={formatMetricValue(def, value(metric))}
        icon={def.icon}
        color={chart.category[def.category]}
        onPress={() => router.push({pathname: '/metric/[id]', params: {id: metric}})}
      />
    );
  };

  return (
    <ScrollView
      style={{backgroundColor: chart.page}}
      contentContainerStyle={{paddingBottom: 32}}
      refreshControl={<RefreshControl refreshing={syncing} onRefresh={sync} progressViewOffset={insets.top} />}
    >
      <LinearGradient
        colors={[colors.primaryContainer, chart.page]}
        style={{paddingTop: insets.top + 20, paddingBottom: 8}}
      >
        <View style={{paddingHorizontal: 20, marginBottom: 4}}>
          <Text variant="headlineMedium" style={{color: chart.inkPrimary, fontWeight: '700'}}>{greeting()}</Text>
          <Text variant="bodyLarge" style={{color: chart.inkSecondary}}>
            {parseIsoDate(date).toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'})}
          </Text>
        </View>
        <View style={{paddingHorizontal: 4}}>
          <SyncStatus />
        </View>

        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 12}}>
          <Pressable onPress={() => toggle('readiness')}>
            <ScoreRing title="Readiness" value={scores.readiness?.value ?? null} label={scores.readiness?.label} calibrating={scores.readiness?.calibrating} size={150} />
          </Pressable>
          <View style={{gap: 16}}>
            {(['sleep', 'activity'] as ScoreKey[]).map((key) => (
              <Pressable key={key} onPress={() => toggle(key)}>
                <ScoreRing title={SCORE_META[key].title} value={scores[key]?.value ?? null} label={scores[key]?.label} calibrating={scores[key]?.calibrating} size={78} />
              </Pressable>
            ))}
          </View>
        </View>
        <Text variant="labelSmall" style={{color: chart.inkMuted, textAlign: 'center', marginBottom: 4}}>Tap a score to see what&apos;s driving it</Text>
      </LinearGradient>

      {open && openScore && <ScoreDetails title={SCORE_META[openScore].title} icon={SCORE_META[openScore].icon} score={open} />}

      {!loading && !hasAnyData && (
        <Panel>
          <PanelHeader title="Connect your data" subtitle="Link Health Connect and Garmin to get started" icon="link-variant" color={colors.primary} />
          <Button mode="contained" onPress={() => router.push('/settings')} style={{alignSelf: 'flex-start'}}>Open settings</Button>
        </Panel>
      )}

      {lastNight && (
        <Panel onPress={() => router.push({pathname: '/metric/[id]', params: {id: 'sleep_total_min'}})}>
          <PanelHeader
            title={lastNight.date === date ? 'Last night' : `Sleep · ${parseIsoDate(lastNight.date).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})}`}
            subtitle={`${formatClock(minutesFromMidnight(lastNight.startTs, lastNight.date))} → ${formatClock(minutesFromMidnight(lastNight.endTs, lastNight.date))}`}
            icon="weather-night"
            color={chart.category.sleep}
            right={
              <Text variant="headlineSmall" style={{color: chart.inkPrimary, fontWeight: '700'}}>
                {formatMinutes(lastNight.deepMin + lastNight.lightMin + lastNight.remMin)}
              </Text>
            }
          />
          <StageBar night={lastNight} />
        </Panel>
      )}

      <SectionHeader title="Today" />
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 8}}>
        {tile('body_battery_wake', 'Body Battery at wake')}
        {tile('garmin_sleep_score')}
        {tile('resting_hr')}
        {tile('stress_avg')}
        {tile('steps')}
        {tile('active_kcal')}
      </View>

      <SectionHeader
        title="Insights"
        right={insights.length > 3 ? (
          <Button compact onPress={() => setShowAllInsights(!showAllInsights)}>{showAllInsights ? 'Show fewer' : `All ${insights.length}`}</Button>
        ) : undefined}
      />
      {insights.length === 0 ? (
        <Panel>
          <Text style={{color: chart.inkMuted}}>Nothing stands out yet. Insights appear once there are a couple of weeks of data.</Text>
        </Panel>
      ) : (
        visibleInsights.map((i) => <InsightCard key={i.id} insight={i} />)
      )}

      {tags.length > 0 && (
        <>
          <SectionHeader title="Log today" />
          <Panel>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {tags.map((t) => {
                const count = tagEntries.find((e) => e.tagId === t.id && e.date === date)?.value ?? 0;
                return (
                  <Chip
                    key={t.id}
                    selected={count > 0}
                    showSelectedOverlay
                    icon={count > 0 ? 'check' : 'plus'}
                    onPress={() => setTagValue(t.id, date, count + 1)}
                    onLongPress={() => setTagValue(t.id, date, Math.max(0, count - 1))}
                  >
                    {count > 1 ? `${t.name} ×${count}` : t.name}
                  </Chip>
                );
              })}
            </View>
            <Text variant="labelSmall" style={{color: chart.inkMuted, marginTop: 10}}>Tap to add one, long-press to remove one</Text>
          </Panel>
        </>
      )}
    </ScrollView>
  );
}
