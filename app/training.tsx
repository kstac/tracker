import {useState} from 'react';
import {ScrollView, View} from 'react-native';
import {Button, SegmentedButtons, Text} from 'react-native-paper';
import {activityIcon, activityLabel} from '@/components/training/activityTypes';
import {DailyLoadChart, FitnessChart} from '@/components/training/LoadCharts';
import IconBadge from '@/components/ui/IconBadge';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {activityLoad, dedupeActivities, FORM_ZONE_TEXT, LoadStatus} from '@/insights';
import {formatMinutes, parseIsoDate} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {AppTheme, useAppTheme} from '@/theme';

const STATUS_LABEL: Record<LoadStatus, string> = {
  calibrating: 'Calibrating',
  overreaching: 'Overreaching',
  high: 'High load',
  building: 'Building',
  maintaining: 'Maintaining',
  recovering: 'Recovering',
  detraining: 'Detraining',
};

function statusColor(status: LoadStatus, chart: AppTheme['chart']) {
  if (status === 'overreaching') return chart.status.critical;
  if (status === 'high' || status === 'detraining') return chart.status.warning;
  if (status === 'building' || status === 'maintaining') return chart.status.good;
  return chart.inkSecondary;
}

function Stat({label, value, sub}: {label: string; value: string; sub?: string}) {
  const {chart} = useAppTheme();
  return (
    <View style={{flex: 1}}>
      <Text variant="labelMedium" style={{color: chart.inkSecondary}}>{label}</Text>
      <Text variant="titleLarge" style={{color: chart.inkPrimary, fontWeight: '700'}}>{value}</Text>
      {sub ? <Text variant="labelSmall" style={{color: chart.inkMuted}}>{sub}</Text> : null}
    </View>
  );
}

const RANGES = [{value: '30', label: '1M'}, {value: '90', label: '3M'}, {value: '365', label: '1Y'}];
const PAGE = 20;

export default function TrainingScreen() {
  const {chart} = useAppTheme();
  const {report, activities} = useAppData();
  const [range, setRange] = useState('90');
  const [shown, setShown] = useState(PAGE);
  if (!report) return null;
  const load = report.load;
  const days = load.days.slice(-Number(range));
  const workouts = dedupeActivities(activities).reverse();
  const zone = load.formZone ? FORM_ZONE_TEXT[load.formZone] : null;
  const color = statusColor(load.status, chart);
  const maxHrText = {setting: 'from your settings', observed: 'your highest recorded', age: 'estimated from your age', default: 'a default; set your age or max HR in Settings'}[load.profile.maxHrSource];

  return (
    <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingTop: 12, paddingBottom: 32}}>
      <Panel>
        <PanelHeader title={STATUS_LABEL[load.status]} subtitle={load.statusText} icon="trending-up" color={color} />
        <View style={{flexDirection: 'row'}}>
          <Stat label="Load ratio" value={load.today?.acwr != null ? load.today.acwr.toFixed(2) : '–'} sub="Last 7 days vs 4 weeks · aim 0.8–1.3" />
          <Stat label="Form" value={zone?.label ?? '–'} sub={zone?.detail} />
        </View>
        <View style={{flexDirection: 'row', marginTop: 14}}>
          <Stat label="This week" value={String(Math.round(load.weekLoad))} sub={`Week before ${Math.round(load.prevWeekLoad)}`} />
          <Stat label="Today's target" value={load.target ? `${load.target.low}–${load.target.high}` : '–'} sub={`Today so far ${Math.round(load.today?.load ?? 0)}`} />
        </View>
      </Panel>

      <View style={{paddingHorizontal: 16, marginBottom: 12}}>
        <SegmentedButtons value={range} onValueChange={setRange} density="small" buttons={RANGES} />
      </View>

      <Panel>
        <PanelHeader title="Daily training load" subtitle="Heart-rate load from workouts, or intensity minutes, whichever is higher" icon="chart-bar" color={chart.category.activity} />
        <DailyLoadChart days={days} target={load.target} />
      </Panel>

      <Panel>
        <PanelHeader title="Fitness and fatigue" subtitle="Long-term vs short-term load" icon="chart-line" color={chart.series[0]} />
        <FitnessChart days={days} />
        <Text variant="bodySmall" style={{color: chart.inkMuted, marginTop: 8}}>
          When fatigue sits above fitness you&apos;re building (or overdoing it); when it drops below you&apos;re freshening up.
        </Text>
      </Panel>

      <Panel padded={false}>
        <View style={{padding: 16, paddingBottom: 4}}>
          <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>Workouts · {workouts.length}</Text>
          <Text variant="bodySmall" style={{color: chart.inkMuted}}>Load uses resting HR {Math.round(load.profile.restingHr)} and max HR {load.profile.maxHr} ({maxHrText}).</Text>
        </View>
        {workouts.length === 0 && <Text style={{color: chart.inkMuted, padding: 16}}>No workouts synced yet.</Text>}
        {workouts.slice(0, shown).map((a) => (
          <View key={a.id} style={{flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: chart.grid}}>
            <IconBadge icon={activityIcon(a.type)} color={chart.category.activity} size={32} />
            <View style={{flex: 1}}>
              <Text variant="bodyMedium" style={{color: chart.inkPrimary, fontWeight: '500'}}>{a.name ?? activityLabel(a.type)}</Text>
              <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
                {parseIsoDate(a.date).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})} · {formatMinutes(a.durationMin)}
                {a.distanceKm ? ` · ${a.distanceKm.toFixed(1)} km` : ''}{a.avgHr ? ` · ${Math.round(a.avgHr)} bpm` : ''}{a.aerobicTe ? ` · TE ${a.aerobicTe.toFixed(1)}` : ''}
              </Text>
              {a.zoneMin && (
                <View style={{flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 4, gap: 1}}>
                  {a.zoneMin.map((m, i) => m > 0 && <View key={i} style={{flex: m, backgroundColor: [chart.series[0], chart.status.good, chart.status.warning, chart.series[1], chart.status.critical][i]}} />)}
                </View>
              )}
            </View>
            <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '700'}}>{Math.round(activityLoad(a, load.profile))}</Text>
          </View>
        ))}
        {workouts.length > shown && <Button onPress={() => setShown(shown + PAGE)} style={{margin: 8}}>Show more</Button>}
      </Panel>
    </ScrollView>
  );
}
