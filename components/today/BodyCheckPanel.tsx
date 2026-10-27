import {View} from 'react-native';
import {router} from 'expo-router';
import {Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {BodyCheck, RadarLevel, TIER_LABEL, Vital, VitalTier} from '@/insights';
import {round} from '@/insights/stats';
import {AppTheme, useAppTheme} from '@/theme';

export function tierColor(tier: VitalTier, chart: AppTheme['chart']) {
  if (tier === 'notably_off') return chart.status.critical;
  if (tier === 'slightly_off') return chart.status.warning;
  if (tier === 'favorable') return chart.status.good;
  return chart.inkSecondary;
}

export function radarColor(level: RadarLevel, chart: AppTheme['chart']) {
  return level === 'major' ? chart.status.critical : level === 'minor' ? chart.status.warning : chart.status.good;
}

const fmt = (v: Vital, value: number) => `${round(value, v.decimals)}${v.unit ? ` ${v.unit}` : ''}`;

/** Where today's value sits against your usual range (±1 SD shaded, ±2.5 SD across the bar). */
export function VitalBand({vital}: {vital: Vital}) {
  const {chart} = useAppTheme();
  const span = Math.max(vital.sd * 2.5, 1e-6);
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - (vital.mean - span)) / (span * 2)) * 100));
  const lo = pos(vital.mean - vital.sd);
  const hi = pos(vital.mean + vital.sd);
  const color = tierColor(vital.tier, chart);
  return (
    <View style={{height: 10, justifyContent: 'center'}}>
      <View style={{height: 4, borderRadius: 2, backgroundColor: chart.grid}} />
      <View style={{position: 'absolute', left: `${lo}%`, width: `${hi - lo}%`, height: 4, borderRadius: 2, backgroundColor: `${chart.status.good}55`}} />
      <View style={{position: 'absolute', left: `${pos(vital.value)}%`, marginLeft: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: color, borderWidth: 2, borderColor: chart.surface}} />
    </View>
  );
}

export function VitalRow({vital, detailed}: {vital: Vital; detailed?: boolean}) {
  const {chart} = useAppTheme();
  const color = tierColor(vital.tier, chart);
  return (
    <View style={{gap: 4}}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
        <Text variant="bodyMedium" style={{color: chart.inkPrimary, flex: 1}}>{vital.label}</Text>
        <Text variant="bodyMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>{fmt(vital, vital.value)}</Text>
        <View style={{backgroundColor: `${color}22`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, minWidth: 92, alignItems: 'center'}}>
          <Text variant="labelSmall" style={{color}}>{vital.ready ? TIER_LABEL[vital.tier] : 'Learning'}</Text>
        </View>
      </View>
      {vital.ready && <VitalBand vital={vital} />}
      {detailed && vital.ready && (
        <Text variant="bodySmall" style={{color: chart.inkMuted}}>
          Usual {fmt(vital, vital.mean - vital.sd)}–{fmt(vital, vital.mean + vital.sd)}
        </Text>
      )}
    </View>
  );
}

export function RadarStrip({history}: {history: BodyCheck['history']}) {
  const {chart} = useAppTheme();
  return (
    <View style={{flexDirection: 'row', gap: 2}}>
      {history.map((h) => (
        <View key={h.date} style={{flex: 1, height: 10, borderRadius: 2, backgroundColor: h.level === 'none' ? chart.grid : radarColor(h.level, chart)}} />
      ))}
    </View>
  );
}

export function radarText(check: BodyCheck): string {
  const {radar} = check;
  if (radar.level === 'none') return 'No signs of strain. Your overnight signals look normal.';
  const lead = radar.level === 'major' ? 'Strong signs of strain' : 'Some signs of strain';
  return `${lead}: ${radar.hits.map((h) => h.text).join('; ')}.${radar.explanation ? ` ${radar.explanation}` : ''}`;
}

export default function BodyCheckPanel({check}: {check: BodyCheck}) {
  const {chart} = useAppTheme();
  const {radar} = check;
  if (!check.vitals.length) return null;
  const color = radarColor(radar.level, chart);
  return (
    <Panel onPress={() => router.push('/body')}>
      <PanelHeader
        title="Body check"
        subtitle="Last night's vitals against your normal range"
        icon={radar.level === 'none' ? 'shield-check-outline' : 'shield-alert-outline'}
        color={color}
      />
      <View style={{gap: 12}}>
        {check.vitals.map((v) => <VitalRow key={v.metric} vital={v} />)}
      </View>
      <View style={{marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: chart.grid, gap: 8}}>
        <Text variant="bodySmall" style={{color: radar.level === 'none' ? chart.inkSecondary : color}}>{radarText(check)}</Text>
        <RadarStrip history={check.history} />
        <Text variant="labelSmall" style={{color: chart.inkMuted}}>Strain signals over the last 30 days</Text>
      </View>
    </Panel>
  );
}
