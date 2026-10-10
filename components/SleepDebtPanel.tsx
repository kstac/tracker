import {useState} from 'react';
import {Pressable, View} from 'react-native';
import {Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {BedtimeShift, SleepDebt} from '@/insights';
import {formatClock, formatMinutes, parseIsoDate} from '@/lib/dates';
import {useAppTheme} from '@/theme';

const BAR_AREA = 36;
const SCALE_MIN = 120;

export function shiftText(delta: number) {
  if (Math.abs(delta) < 10) return 'about as usual';
  return `${formatMinutes(Math.abs(delta))} ${delta > 0 ? 'later' : 'earlier'} than usual`;
}

export default function SleepDebtPanel({debt, bedtime}: {debt: SleepDebt; bedtime: BedtimeShift | null}) {
  const {chart} = useAppTheme();
  const [selected, setSelected] = useState<number | null>(null);
  const hasDebt = debt.debtMin >= 15;
  const change = debt.weekAgoDebtMin == null ? null : debt.debtMin - debt.weekAgoDebtMin;
  const sel = selected != null ? debt.nights[selected] : null;
  const surplus = chart.series[0];
  const deficit = chart.series[7];

  return (
    <Panel>
      <PanelHeader
        title="Sleep debt"
        subtitle={`Last ${debt.nights.length} nights against ${formatMinutes(debt.needMin)} a night`}
        icon="bed-clock"
        color={chart.category.sleep}
        right={
          <Text variant="headlineSmall" style={{color: chart.inkPrimary, fontWeight: '700'}}>
            {hasDebt ? formatMinutes(debt.debtMin) : 'None'}
          </Text>
        }
      />

      <View style={{flexDirection: 'row', alignItems: 'center', height: BAR_AREA * 2, gap: 3}}>
        {debt.nights.map((n, i) => {
          const h = n.diffMin == null ? 0 : (Math.min(SCALE_MIN, Math.abs(n.diffMin)) / SCALE_MIN) * BAR_AREA;
          const up = (n.diffMin ?? 0) >= 0;
          return (
            <Pressable key={n.date} onPress={() => setSelected(i === selected ? null : i)} style={{flex: 1, height: '100%', justifyContent: 'center'}}>
              <View style={{height: BAR_AREA, justifyContent: 'flex-end'}}>
                {up && <View style={{height: Math.max(2, h), backgroundColor: n.diffMin == null ? 'transparent' : surplus, borderTopLeftRadius: 3, borderTopRightRadius: 3, opacity: selected == null || selected === i ? 1 : 0.4}} />}
              </View>
              <View style={{height: 1, backgroundColor: chart.axis}} />
              <View style={{height: BAR_AREA}}>
                {!up && <View style={{height: Math.max(2, h), backgroundColor: deficit, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, opacity: selected == null || selected === i ? 1 : 0.4}} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text variant="bodySmall" style={{color: chart.inkSecondary, marginTop: 8}}>
        {sel
          ? `${parseIsoDate(sel.date).toLocaleDateString(undefined, {weekday: 'short', day: 'numeric', month: 'short'})} · ` +
            (sel.asleepMin == null ? 'no sleep recorded' : `${formatMinutes(sel.asleepMin)} asleep (${sel.diffMin! >= 0 ? '+' : '−'}${formatMinutes(Math.abs(sel.diffMin!))})`)
          : 'Above the line: more than you need · below: less. Tap a night for details.'}
      </Text>

      <View style={{marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: chart.grid, gap: 4}}>
        {change != null && Math.abs(change) >= 15 && (
          <Text variant="bodyMedium" style={{color: change < 0 ? chart.deltaGood : chart.status.critical}}>
            {formatMinutes(Math.abs(change))} {change < 0 ? 'less' : 'more'} debt than a week ago
          </Text>
        )}
        {bedtime && (
          <Text variant="bodyMedium" style={{color: chart.inkPrimary}}>
            Bedtime this week: {bedtime.weekAvgDelta == null ? '–' : shiftText(bedtime.weekAvgDelta)}
            <Text style={{color: chart.inkSecondary}}> (usual {formatClock(bedtime.usual)})</Text>
          </Text>
        )}
      </View>
    </Panel>
  );
}
