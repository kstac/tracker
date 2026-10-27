import {useState} from 'react';
import {Pressable, View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {router} from 'expo-router';
import {Button, Text} from 'react-native-paper';
import {CONFIDENCE_LABEL, Effect, FactorProgress, TargetMetric} from '@/insights';
import {formatMetricValue} from '@/lib/format';
import {METRIC_BY_ID} from '@/metrics/registry';
import {useAppTheme} from '@/theme';

export function formatTargetValue(metric: TargetMetric, v: number): string {
  if (metric === 'sleep_score' || metric === 'readiness') return String(Math.round(v));
  return formatMetricValue(METRIC_BY_ID[metric], v);
}

function signed(metric: TargetMetric, v: number): string {
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${formatTargetValue(metric, Math.abs(v))}`;
}

export function openFactor(effect: Pick<Effect, 'factorId' | 'factorKind'>) {
  if (effect.factorKind === 'tag') router.push({pathname: '/tag/[id]', params: {id: effect.factorId}});
  else router.push({pathname: '/factor/[id]', params: {id: effect.factorId}});
}

/** `detailed` adds the dose and timing breakdowns, which are worth showing once per factor rather than on every row. */
export function EffectRow({effect, onPress, detailed = false}: {effect: Effect; onPress?: () => void; detailed?: boolean}) {
  const {chart} = useAppTheme();
  const color = effect.good == null ? chart.inkSecondary : effect.good ? chart.deltaGood : chart.status.critical;
  const icon = effect.diff > 0 ? 'arrow-up-bold-circle-outline' : 'arrow-down-bold-circle-outline';
  const adjusted = effect.adjustedDiff != null && Math.abs(effect.adjustedDiff - effect.rawDiff) >= Math.max(0.5, Math.abs(effect.rawDiff) * 0.25);
  const body = (
    <View style={{flexDirection: 'row', gap: 10}}>
      <MaterialCommunityIcons name={icon} size={22} color={color} style={{marginTop: 1}} />
      <View style={{flex: 1, gap: 2}}>
        <Text variant="bodyMedium" style={{color: chart.inkPrimary}}>{effect.summary}</Text>
        <Text variant="bodySmall" style={{color: chart.inkMuted}}>
          {CONFIDENCE_LABEL[effect.confidence]} · {effect.nWith} days with, {effect.nWithout} without · likely between {signed(effect.metric, effect.ciLow)} and {signed(effect.metric, effect.ciHigh)}
        </Text>
        {adjusted && (
          <Text variant="bodySmall" style={{color: chart.inkMuted}}>
            The raw difference is {signed(effect.metric, effect.rawDiff)}; this figure allows for weekends, training and other tags.
          </Text>
        )}
        {effect.sharedWith.length > 0 && (
          <Text variant="bodySmall" style={{color: chart.status.warning}}>Usually logged with {effect.sharedWith.join(', ')}, so their effects can&apos;t be separated.</Text>
        )}
        {detailed && effect.dose && (
          <View style={{marginTop: 6, gap: 4}}>
            <Text variant="labelSmall" style={{color: chart.inkSecondary}}>By amount</Text>
            {effect.dose.map((b) => (
              <View key={b.label} style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{b.label} <Text style={{color: chart.inkMuted}}>({b.n} days)</Text></Text>
                <Text variant="bodySmall" style={{color: chart.inkPrimary, fontWeight: '600'}}>{formatTargetValue(effect.metric, b.mean)}</Text>
              </View>
            ))}
          </View>
        )}
        {detailed && effect.timing && (
          <Text variant="bodySmall" style={{color: chart.inkSecondary, marginTop: 4}}>
            Within {effect.timing.thresholdHours}h of bed: {formatTargetValue(effect.metric, effect.timing.lateMean)} ({effect.timing.nLate} days) · earlier: {formatTargetValue(effect.metric, effect.timing.earlyMean)} ({effect.timing.nEarly} days)
          </Text>
        )}
      </View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

type ListProps = {effects: Effect[]; progress?: FactorProgress | null; factorName?: string};

/** Effects for one factor: clear patterns first, then weaker hints, then what showed no link. */
export function EffectList({effects, progress, factorName}: ListProps) {
  const {chart} = useAppTheme();
  const [showWeak, setShowWeak] = useState(false);
  const clear = effects.filter((e) => e.confidence === 'strong' || e.confidence === 'likely');
  const weak = effects.filter((e) => e.confidence === 'possible');
  const none = effects.filter((e) => e.confidence === 'none');
  const needed = progress ? progress.withNeeded + progress.withoutNeeded : 0;

  return (
    <View style={{gap: 14}}>
      {needed > 0 && progress && (
        <Text style={{color: chart.inkSecondary}}>
          Still learning. Patterns need at least 5 days with {factorName ?? 'it'} and 5 without, with sleep recorded the night after
          {progress.withNeeded ? `: log it on ${progress.withNeeded} more ${progress.withNeeded === 1 ? 'day' : 'days'}` : ''}
          {progress.withoutNeeded ? `${progress.withNeeded ? ' and' : ':'} ${progress.withoutNeeded} more without` : ''}.
        </Text>
      )}
      {clear.length === 0 && needed === 0 && (
        <Text style={{color: chart.inkMuted}}>No clear pattern yet. Keep logging; clearer effects show up with more days.</Text>
      )}
      {clear.map((e, i) => <EffectRow key={e.targetKey} effect={e} detailed={i === 0} />)}
      {weak.length > 0 && (
        showWeak ? (
          <>
            <Text variant="labelMedium" style={{color: chart.inkSecondary}}>Possible patterns (could still be chance)</Text>
            {weak.map((e) => <EffectRow key={e.targetKey} effect={e} />)}
          </>
        ) : (
          <Button compact mode="text" style={{alignSelf: 'flex-start'}} onPress={() => setShowWeak(true)}>
            Show {weak.length} weaker {weak.length === 1 ? 'hint' : 'hints'}
          </Button>
        )
      )}
      {none.length > 0 && (
        <Text variant="bodySmall" style={{color: chart.inkMuted}}>
          No clear link with: {[...new Set(none.map((e) => `${e.targetLabel.toLowerCase()}${e.lag === 2 ? ' (2 days later)' : ''}`))].join(', ')}.
        </Text>
      )}
      <Text variant="bodySmall" style={{color: chart.inkMuted}}>
        Patterns are correlations, not proof of cause. Strong patterns survive a check for chance across everything tested.
      </Text>
    </View>
  );
}
