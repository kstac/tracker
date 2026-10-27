import {View} from 'react-native';
import {Text} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {DEBT_LEVEL_LABEL, SleepPlan} from '@/insights';
import {formatClock, formatMinutes, parseIsoDate} from '@/lib/dates';
import {useAppTheme} from '@/theme';

function Row({label, value, muted}: {label: string; value: string; muted?: boolean}) {
  const {chart} = useAppTheme();
  return (
    <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
      <Text variant="bodySmall" style={{color: muted ? chart.inkMuted : chart.inkSecondary}}>{label}</Text>
      <Text variant="bodySmall" style={{color: muted ? chart.inkMuted : chart.inkPrimary, fontWeight: '600'}}>{value}</Text>
    </View>
  );
}

const NEED_SOURCE = {setting: 'your setting', auto: 'from your longer nights', default: 'a default until there is more data'};

export default function SleepPlanPanel({plan}: {plan: SleepPlan}) {
  const {chart} = useAppTheme();
  const {need} = plan;
  const target = plan.stepBedtime ?? plan.bedtime;
  const weekday = parseIsoDate(plan.wakeDate).toLocaleDateString(undefined, {weekday: 'long'});
  return (
    <Panel>
      <PanelHeader
        title="Tonight"
        subtitle={`To wake at ${formatClock(plan.wakeTarget)} on ${weekday}${plan.wakeSource === 'usual' ? ' (your usual)' : ''}`}
        icon="bed-clock"
        color={chart.category.sleep}
        right={
          <View style={{alignItems: 'flex-end'}}>
            <Text variant="labelSmall" style={{color: chart.inkMuted}}>Asleep by</Text>
            <Text variant="headlineSmall" style={{color: chart.inkPrimary, fontWeight: '700'}}>{formatClock(target)}</Text>
          </View>
        }
      />
      {plan.stepBedtime != null && (
        <Text variant="bodySmall" style={{color: chart.inkSecondary, marginBottom: 8}}>
          Your full target is {formatClock(plan.bedtime)}, but that&apos;s a big jump from your usual {plan.usualBedtime != null ? formatClock(plan.usualBedtime) : ''}. Moving 30 minutes at a time is easier to keep.
        </Text>
      )}
      <View style={{gap: 4}}>
        <Row label={`Baseline need (${NEED_SOURCE[need.source]})`} value={formatMinutes(need.baselineMin)} />
        {need.debtRepayMin > 0 && <Row label={`Paying back sleep debt (${DEBT_LEVEL_LABEL[plan.debtLevel].toLowerCase()})`} value={`+${formatMinutes(need.debtRepayMin)}`} />}
        {need.strainMin > 0 && <Row label="Extra for today's training" value={`+${formatMinutes(need.strainMin)}`} />}
        {need.napMin > 0 && <Row label="Credit for today's nap" value={`−${formatMinutes(need.napMin)}`} />}
        <Row label={`Usual time awake in the night`} value={`+${formatMinutes(plan.usualAwakeMin)}`} muted />
        <View style={{height: 1, backgroundColor: chart.grid, marginVertical: 4}} />
        <Row label="Sleep to aim for tonight" value={formatMinutes(need.tonightMin)} />
      </View>
    </Panel>
  );
}
