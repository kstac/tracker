import {View} from 'react-native';
import {router} from 'expo-router';
import {Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {activityLabel} from '@/components/training/activityTypes';
import {dedupeActivities, LoadReport} from '@/insights';
import {formatMinutes, IsoDate, parseIsoDate} from '@/lib/dates';
import {Activity} from '@/metrics/types';
import {useAppTheme} from '@/theme';

function ProgressBar({fraction, color, band}: {fraction: number; color: string; band?: [number, number]}) {
  const {chart} = useAppTheme();
  const pct = (v: number) => `${Math.max(0, Math.min(100, v * 100))}%` as const;
  return (
    <View style={{height: 10, borderRadius: 5, backgroundColor: chart.grid, overflow: 'hidden'}}>
      {band && <View style={{position: 'absolute', left: pct(band[0]), width: pct(band[1] - band[0]), top: 0, bottom: 0, backgroundColor: `${chart.status.good}40`}} />}
      <View style={{width: pct(fraction), height: '100%', borderRadius: 5, backgroundColor: color}} />
    </View>
  );
}

type Props = {date: IsoDate; steps: number | null; stepGoal: number; load: LoadReport; activities: Activity[]};

export default function ActivityPanel({date, steps, stepGoal, load, activities}: Props) {
  const {chart} = useAppTheme();
  const color = chart.category.activity;
  const todayLoad = load.today?.load ?? 0;
  const target = load.target;
  const scale = Math.max(target?.high ?? 0, todayLoad, 1) * 1.25;
  const recent = dedupeActivities(activities.filter((a) => a.date <= date)).at(-1);
  const week = load.weekLoad;
  const weekDiff = load.prevWeekLoad > 0 ? Math.round(((week - load.prevWeekLoad) / load.prevWeekLoad) * 100) : null;

  return (
    <Panel onPress={() => router.push('/training')}>
      <PanelHeader title="Activity & training" subtitle={target ? target.reason : load.statusText} icon="run-fast" color={color} />
      <View style={{gap: 14}}>
        <View style={{gap: 6}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <Text variant="bodyMedium" style={{color: chart.inkSecondary}}>Steps</Text>
            <Text variant="bodyMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>
              {steps == null ? '–' : Math.round(steps).toLocaleString()} <Text style={{color: chart.inkMuted, fontWeight: '400'}}>/ {stepGoal.toLocaleString()}</Text>
            </Text>
          </View>
          <ProgressBar fraction={(steps ?? 0) / stepGoal} color={color} />
        </View>
        <View style={{gap: 6}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            <Text variant="bodyMedium" style={{color: chart.inkSecondary}}>Training load today</Text>
            <Text variant="bodyMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>
              {Math.round(todayLoad)}{target ? <Text style={{color: chart.inkMuted, fontWeight: '400'}}> · target {target.low}–{target.high}</Text> : null}
            </Text>
          </View>
          <ProgressBar fraction={todayLoad / scale} color={chart.series[0]} band={target ? [target.low / scale, target.high / scale] : undefined} />
        </View>
        <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
          <Text variant="bodySmall" style={{color: chart.inkSecondary}}>Last 7 days: {Math.round(week)} load{weekDiff != null ? ` (${weekDiff > 0 ? '+' : ''}${weekDiff}% vs the week before)` : ''}</Text>
        </View>
        {recent && (
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
            <Text variant="bodySmall" style={{color: chart.inkMuted}}>
              Last workout: {recent.name ?? activityLabel(recent.type)} · {parseIsoDate(recent.date).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})} · {formatMinutes(recent.durationMin)}
              {recent.avgHr ? ` · ${Math.round(recent.avgHr)} bpm` : ''}
            </Text>
          </View>
        )}
      </View>
    </Panel>
  );
}
