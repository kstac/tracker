import {useState} from 'react';
import {View} from 'react-native';
import {SegmentedButtons, Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {WeeklySummary} from '@/insights';
import {formatMinutes, IsoDate, parseIsoDate} from '@/lib/dates';
import {useAppTheme} from '@/theme';

const fmtShort = (d: IsoDate) => parseIsoDate(d).toLocaleDateString(undefined, {day: 'numeric', month: 'short'});

export default function WeeklySummaryPanel({current, previous}: {current: WeeklySummary; previous: WeeklySummary}) {
  const {chart, colors} = useAppTheme();
  const [view, setView] = useState<'current' | 'previous'>('current');
  const summary = view === 'current' ? current : previous;
  const {thisWeek: a, lastWeek: b} = summary;
  const subtitle = summary.partial
    ? `${fmtShort(a.from)} – ${fmtShort(a.to)} vs the same days last week`
    : `${fmtShort(a.from)} – ${fmtShort(a.to)} vs the week before`;
  const cols = view === 'current' ? ['This week', 'Last week'] : ['Last week', 'Week before'];
  const rows: {label: string; now: string; before: string}[] = [
    {label: 'Readiness', now: num(a.readiness), before: num(b.readiness)},
    {label: 'Sleep score', now: num(a.sleepScore), before: num(b.sleepScore)},
    {label: 'Sleep per night', now: dur(a.sleepMin), before: dur(b.sleepMin)},
    {label: 'Steps per day', now: num(a.stepsPerDay, true), before: num(b.stepsPerDay, true)},
    {label: 'Intensity minutes', now: num(a.intensityMin), before: num(b.intensityMin)},
    {label: 'Resting HR', now: num(a.restingHr, false, ' bpm'), before: num(b.restingHr, false, ' bpm')},
  ];

  return (
    <Panel>
      <PanelHeader title={view === 'current' ? (summary.partial ? 'This week so far' : 'This week') : 'Last week'} subtitle={subtitle} icon="calendar-week" color={colors.primary} />
      <SegmentedButtons
        value={view}
        onValueChange={(v) => setView(v as 'current' | 'previous')}
        density="small"
        style={{marginBottom: 14}}
        buttons={[{value: 'current', label: 'This week'}, {value: 'previous', label: 'Last week'}]}
      />
      {summary.highlights.length > 0 ? (
        <View style={{gap: 8, marginBottom: 14}}>
          {summary.highlights.map((h) => (
            <View key={h} style={{flexDirection: 'row', gap: 8}}>
              <Text style={{color: colors.primary}}>•</Text>
              <Text variant="bodyMedium" style={{color: chart.inkPrimary, flex: 1}}>{h}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text variant="bodyMedium" style={{color: chart.inkMuted, marginBottom: 14}}>Not enough data yet to compare weeks.</Text>
      )}
      <View style={{borderTopWidth: 1, borderTopColor: chart.grid, paddingTop: 10, gap: 6}}>
        <View style={{flexDirection: 'row'}}>
          <View style={{flex: 1}} />
          <Text variant="labelSmall" style={{width: 72, textAlign: 'right', color: chart.inkMuted}}>{cols[0]}</Text>
          <Text variant="labelSmall" style={{width: 72, textAlign: 'right', color: chart.inkMuted}}>{cols[1]}</Text>
        </View>
        {rows.map((r) => (
          <View key={r.label} style={{flexDirection: 'row'}}>
            <Text variant="bodySmall" style={{flex: 1, color: chart.inkSecondary}}>{r.label}</Text>
            <Text variant="bodySmall" style={{width: 72, textAlign: 'right', color: chart.inkPrimary, fontWeight: '600'}}>{r.now}</Text>
            <Text variant="bodySmall" style={{width: 72, textAlign: 'right', color: chart.inkSecondary}}>{r.before}</Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

function num(v: number | null, thousands = false, suffix = ''): string {
  if (v == null) return '–';
  return `${thousands ? Math.round(v).toLocaleString() : Math.round(v)}${suffix}`;
}

function dur(v: number | null): string {
  return v == null ? '–' : formatMinutes(v);
}
