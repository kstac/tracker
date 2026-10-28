import {useState} from 'react';
import {Pressable, RefreshControl, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Button, Chip, Text} from 'react-native-paper';
import InsightCard from '@/components/InsightCard';
import TagAmountDialog from '@/components/tags/TagAmountDialog';
import {formatTagAmount} from '@/insights/tagStats';
import ScoreDetails from '@/components/ScoreDetails';
import ScoreRing from '@/components/ScoreRing';
import SyncStatus from '@/components/SyncStatus';
import CollapsiblePanel from '@/components/ui/CollapsiblePanel';
import {Panel, PanelHeader, SectionHeader} from '@/components/ui/Panel';
import {ACTION_TEXT, computeBedtimeShift, Score, topDrags} from '@/insights';
import {median} from '@/insights/stats';
import SleepDebtPanel, {shiftText} from '@/components/SleepDebtPanel';
import CheckInCard from '@/components/journal/CheckInCard';
import StatusControl from '@/components/journal/StatusControl';
import ActivityPanel from '@/components/today/ActivityPanel';
import BodyCheckPanel from '@/components/today/BodyCheckPanel';
import SleepPlanPanel from '@/components/today/SleepPlanPanel';
import StressPanel from '@/components/today/StressPanel';
import YesterdayPrompt from '@/components/today/YesterdayPrompt';
import {addDays, formatClock, formatMinutes, IsoDate, minutesFromMidnight, nightLabel, parseIsoDate, today} from '@/lib/dates';
import {SleepNight, Tag} from '@/metrics/types';
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

function ReadinessSummary({score}: {score: Score}) {
  const {chart} = useAppTheme();
  if (!score.action || score.calibrating) return null;
  const drags = topDrags(score);
  return (
    <View style={{paddingHorizontal: 24, gap: 2, marginBottom: 6}}>
      <Text variant="bodyMedium" style={{color: chart.inkPrimary, textAlign: 'center'}}>{ACTION_TEXT[score.action].advice}</Text>
      {drags.length > 0 && (
        <Text variant="bodySmall" style={{color: chart.inkSecondary, textAlign: 'center'}}>
          Held back by {drags.map((d) => `${d.label.toLowerCase()} (−${Math.round(d.impact ?? 0)})`).join(' and ')}
        </Text>
      )}
    </View>
  );
}

export default function TodayScreen() {
  const {chart, colors} = useAppTheme();
  const insets = useSafeAreaInsets();
  const {report, daily, sleep, tags, tagEntries, activities, syncing, sync, setTagValue, loading} = useAppData();
  const [openScore, setOpenScore] = useState<ScoreKey | null>(null);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [amount, setAmount] = useState<{tag: Tag; date: IsoDate} | null>(null);
  const date = today();
  const yesterday = addDays(date, -1);

  const lastNight = [...sleep].reverse().find((n) => n.date <= date);
  const hasAnyData = Object.keys(daily).length > 0;
  const insights = (report?.insights ?? []).filter((i) => i.id !== 'strain_radar');
  const visibleInsights = showAllInsights ? insights : insights.slice(0, 1);

  const scores: Record<ScoreKey, Score | null> = {
    readiness: report?.readiness ?? null,
    sleep: report?.sleep ?? null,
    activity: report?.activity ?? null,
  };
  const open = openScore ? scores[openScore] : null;
  const plan = report?.sleepPlan ?? null;
  const bedtime = computeBedtimeShift(daily, date);
  const toggle = (key: ScoreKey) => scores[key] && setOpenScore(openScore === key ? null : key);
  const garminScore = lastNight ? daily.garmin_sleep_score?.get(lastNight.date) : undefined;

  const recentScores = report ? [...report.sleepScores.entries()].filter(([d]) => d < date && d >= addDays(date, -30)).map(([, v]) => v) : [];
  const usualScore = recentScores.length >= 7 ? median(recentScores) : null;
  const lastScore = report?.sleep?.date === date ? report.sleep.value : null;
  const unusualNight = lastScore != null && usualScore != null && lastScore <= usualScore - 8;
  const strained = (report?.bodyCheck.radar.level ?? 'none') !== 'none';
  const loggedYesterday = tagEntries.some((e) => e.date === yesterday && e.value > 0);
  const promptReason = unusualNight
    ? `Last night scored ${lastScore}, below your usual ${Math.round(usualScore!)}.`
    : 'Your body check shows some strain this morning.';

  // Once shown, keep the prompt up for the session so several tags can be logged from it.
  const wantPrompt = tags.length > 0 && (unusualNight || strained) && !loggedYesterday;
  const [promptFor, setPromptFor] = useState<IsoDate | null>(null);
  if (wantPrompt && promptFor !== date) setPromptFor(date);

  const logTag = (t: Tag, d: IsoDate, current: number) => {
    if (t.unit) setAmount({tag: t, date: d});
    else setTagValue(t.id, d, current + 1);
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
        <View style={{paddingHorizontal: 20, marginBottom: 4, flexDirection: 'row', alignItems: 'flex-start'}}>
          <View style={{flex: 1}}>
            <Text variant="headlineMedium" style={{color: chart.inkPrimary, fontWeight: '700'}}>{greeting()}</Text>
            <Text variant="bodyLarge" style={{color: chart.inkSecondary}}>
              {parseIsoDate(date).toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'})}
            </Text>
          </View>
          {!report?.status && <StatusControl />}
        </View>
        <View style={{paddingHorizontal: 4}}>
          <SyncStatus />
        </View>

        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 12}}>
          <Pressable onPress={() => toggle('readiness')}>
            <ScoreRing
              title="Readiness"
              value={scores.readiness?.value ?? null}
              label={scores.readiness?.label}
              caption={scores.readiness?.action ? ACTION_TEXT[scores.readiness.action].label : undefined}
              calibrating={scores.readiness?.calibrating}
              size={150}
            />
          </Pressable>
          <View style={{gap: 16}}>
            {(['sleep', 'activity'] as ScoreKey[]).map((key) => (
              <Pressable key={key} onPress={() => toggle(key)}>
                <ScoreRing title={SCORE_META[key].title} value={scores[key]?.value ?? null} label={scores[key]?.label} caption="" calibrating={scores[key]?.calibrating} size={78} />
              </Pressable>
            ))}
          </View>
        </View>
        {scores.readiness && <ReadinessSummary score={scores.readiness} />}
        <Text variant="labelSmall" style={{color: chart.inkMuted, textAlign: 'center', marginBottom: 4}}>Tap a score for details</Text>
      </LinearGradient>

      {open && openScore && (
        <ScoreDetails
          kind={openScore}
          title={SCORE_META[openScore].title}
          icon={SCORE_META[openScore].icon}
          score={open}
          note={openScore === 'sleep' && garminScore != null ? `Garmin scored this night ${Math.round(garminScore)}.` : undefined}
        />
      )}

      <StatusControl showWhenNormal={false} />

      {!loading && !hasAnyData && (
        <Panel>
          <PanelHeader title="Connect your data" subtitle="Link Health Connect and Garmin to get started" icon="link-variant" color={colors.primary} />
          <Button mode="contained" onPress={() => router.push('/settings')} style={{alignSelf: 'flex-start'}}>Open settings</Button>
        </Panel>
      )}

      {hasAnyData && <CheckInCard date={date} title="Morning check-in" />}
      {promptFor === date && (unusualNight || strained || loggedYesterday) && (
        <YesterdayPrompt date={date} reason={promptReason} tags={tags} tagEntries={tagEntries} onLog={logTag} />
      )}

      {tags.length > 0 && (
        <>
          <SectionHeader title="Log today" right={<Button compact icon="notebook-outline" onPress={() => router.push('/journal')}>Journal</Button>} />
          <Panel>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {tags.map((t) => {
                const count = tagEntries.find((e) => e.tagId === t.id && e.date === date)?.value ?? 0;
                if (t.unit) {
                  return (
                    <Chip key={t.id} selected={count > 0} showSelectedOverlay icon={count > 0 ? 'check' : 'scale-balance'} onPress={() => setAmount({tag: t, date})}>
                      {count > 0 ? `${t.name} · ${formatTagAmount(count, t.unit)}` : t.name}
                    </Chip>
                  );
                }
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
            <Text variant="labelSmall" style={{color: chart.inkMuted, marginTop: 10}}>Tap to add, long-press to remove. Notes and past days are in the Journal.</Text>
          </Panel>
        </>
      )}

      {hasAnyData && tags.length === 0 && (
        <Panel onPress={() => router.push('/journal')}>
          <PanelHeader title="Log what you do" subtitle="Add tags like alcohol or caffeine in the Journal to see how they affect you" icon="notebook-outline" color={chart.series[3]} />
        </Panel>
      )}

      {report && <BodyCheckPanel check={report.bodyCheck} />}

      {(lastNight || plan) && <SectionHeader title="Sleep" />}
      {lastNight && (
        <CollapsiblePanel
          id="today.last_night"
          title={lastNight.date === date ? 'Last night' : nightLabel(lastNight.date)}
          subtitle={`${formatClock(minutesFromMidnight(lastNight.startTs, lastNight.date))} → ${formatClock(minutesFromMidnight(lastNight.endTs, lastNight.date))}` +
            (bedtime && lastNight.date >= date ? ` · bed ${shiftText(bedtime.lastDelta)}` : '') +
            (garminScore != null ? ` · Garmin score ${Math.round(garminScore)}` : '')}
          icon="weather-night"
          color={chart.category.sleep}
          defaultOpen
          right={
            <Text variant="headlineSmall" style={{color: chart.inkPrimary, fontWeight: '700'}}>
              {formatMinutes(lastNight.deepMin + lastNight.lightMin + lastNight.remMin)}
            </Text>
          }
          onPress={() => router.push({pathname: '/metric/[id]', params: {id: 'sleep_total_min'}})}
        >
          <StageBar night={lastNight} />
        </CollapsiblePanel>
      )}
      {plan && lastNight && <SleepPlanPanel plan={plan} />}
      {plan?.debt && <SleepDebtPanel debt={plan.debt} bedtime={bedtime} />}

      {report && hasAnyData && (
        <>
          <SectionHeader title="Today" />
          <ActivityPanel date={date} steps={daily.steps?.get(date) ?? null} stepGoal={report.stepGoal} load={report.load} activities={activities} />
          <StressPanel date={date} daily={daily} />
        </>
      )}

      <SectionHeader
        title="Insights"
        right={insights.length > 1 ? (
          <Button compact onPress={() => setShowAllInsights(!showAllInsights)}>{showAllInsights ? 'Show fewer' : `${insights.length - 1} more`}</Button>
        ) : undefined}
      />
      {insights.length === 0 ? (
        <Panel>
          <Text style={{color: chart.inkMuted}}>Nothing stands out yet. Insights appear once there are a couple of weeks of data.</Text>
        </Panel>
      ) : (
        visibleInsights.map((i) => <InsightCard key={i.id} insight={i} />)
      )}

      <TagAmountDialog
        tag={amount?.tag ?? null}
        date={amount?.date ?? date}
        current={amount ? tagEntries.find((e) => e.tagId === amount.tag.id && e.date === amount.date)?.value ?? 0 : 0}
        onDismiss={() => setAmount(null)}
        onSubmit={async (v) => {
          const a = amount;
          setAmount(null);
          if (a) await setTagValue(a.tag.id, a.date, v);
        }}
      />
    </ScrollView>
  );
}
