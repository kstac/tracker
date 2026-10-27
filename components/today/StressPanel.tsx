import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {router} from 'expo-router';
import {Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {getBodyBatteryEvents} from '@/db/repo';
import {windowValues} from '@/insights/baseline';
import {mean} from '@/insights/stats';
import {addDays, formatMinutes, IsoDate} from '@/lib/dates';
import {BodyBatteryEvent, DailyData} from '@/metrics/types';
import {useAppTheme} from '@/theme';

const EVENT_LABEL: Record<string, string> = {sleep: 'Sleep', nap: 'Nap', activity: 'Workout', stress: 'Stressful period', recovery: 'Rest'};

const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});

function stressWord(v: number) {
  if (v <= 25) return 'Resting';
  if (v <= 50) return 'Low';
  if (v <= 75) return 'Medium';
  return 'High';
}

export default function StressPanel({date, daily}: {date: IsoDate; daily: DailyData}) {
  const {chart} = useAppTheme();
  const [events, setEvents] = useState<BodyBatteryEvent[]>([]);
  useEffect(() => {
    getBodyBatteryEvents(date).then(setEvents).catch(() => setEvents([]));
  }, [date, daily]);

  const stress = daily.stress_avg?.get(date) ?? null;
  const usual = mean(windowValues(daily.stress_avg, addDays(date, -1), 30));
  const parts = [
    {key: 'stress_rest_min', label: 'Rest', color: chart.series[0]},
    {key: 'stress_low_min', label: 'Low', color: chart.status.good},
    {key: 'stress_medium_min', label: 'Medium', color: chart.status.warning},
    {key: 'stress_high_min', label: 'High', color: chart.status.critical},
  ] as const;
  const minutes = parts.map((p) => daily[p.key]?.get(date) ?? 0);
  const total = minutes.reduce((a, b) => a + b, 0);
  const high = daily.body_battery_high?.get(date);
  const low = daily.body_battery_low?.get(date);
  const charged = daily.body_battery_charged?.get(date);
  const drained = daily.body_battery_drained?.get(date);
  const notable = [...events].filter((e) => Math.abs(e.impact) >= 5).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 4);

  if (stress == null && high == null) return null;

  return (
    <Panel onPress={() => router.push({pathname: '/metric/[id]', params: {id: 'stress_avg'}})}>
      <PanelHeader
        title="Stress & energy"
        subtitle={usual != null && stress != null ? `Usual daily stress ${Math.round(usual)}` : 'So far today'}
        icon="head-heart-outline"
        color={chart.category.recovery}
        right={stress != null ? (
          <View style={{alignItems: 'flex-end'}}>
            <Text variant="headlineSmall" style={{color: chart.inkPrimary, fontWeight: '700'}}>{Math.round(stress)}</Text>
            <Text variant="labelSmall" style={{color: chart.inkMuted}}>{stressWord(stress)}</Text>
          </View>
        ) : undefined}
      />
      {total > 0 && (
        <View style={{gap: 6, marginBottom: 12}}>
          <View style={{flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2}}>
            {parts.map((p, i) => minutes[i] > 0 && <View key={p.key} style={{flex: minutes[i] / total, backgroundColor: p.color}} />)}
          </View>
          <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
            {parts.map((p, i) => (
              <View key={p.key} style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <View style={{width: 8, height: 8, borderRadius: 2, backgroundColor: p.color}} />
                <Text variant="labelSmall" style={{color: chart.inkSecondary}}>{p.label} {formatMinutes(minutes[i])}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {high != null && (
        <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
          Body Battery {low != null ? `${Math.round(low)}–` : ''}{Math.round(high)}
          {charged != null ? ` · charged +${Math.round(charged)}` : ''}{drained != null ? ` · used −${Math.round(drained)}` : ''}
        </Text>
      )}
      {notable.length > 0 && (
        <View style={{marginTop: 10, gap: 4}}>
          {notable.map((e) => (
            <View key={`${e.startTs}-${e.type}`} style={{flexDirection: 'row', justifyContent: 'space-between'}}>
              <Text variant="bodySmall" style={{color: chart.inkSecondary}}>
                {fmtTime(e.startTs)} · {EVENT_LABEL[e.type] ?? e.type}{e.durationMin >= 1 ? ` (${formatMinutes(e.durationMin)})` : ''}
              </Text>
              <Text variant="bodySmall" style={{color: e.impact > 0 ? chart.deltaGood : chart.status.critical, fontWeight: '600'}}>
                {e.impact > 0 ? '+' : ''}{Math.round(e.impact)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}
