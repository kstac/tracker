import {View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {Text} from 'react-native-paper';
import {formatDelta} from '@/lib/format';
import {MetricDef} from '@/metrics/registry';
import {useAppTheme} from '@/theme';

export default function DeltaPill({def, delta, suffix}: {def: MetricDef; delta: number; suffix?: string}) {
  const {chart} = useAppTheme();
  const flat = Math.abs(delta) < Math.pow(10, -def.decimals) / 2;
  let color = chart.inkSecondary;
  if (!flat && def.higherIsBetter != null) color = (delta > 0) === def.higherIsBetter ? chart.deltaGood : chart.status.critical;
  const icon = flat ? 'minus' : delta > 0 ? 'arrow-top-right' : 'arrow-bottom-right';
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', backgroundColor: `${color}1a`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2}}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text variant="labelSmall" style={{color}}>{formatDelta(def, delta)}{suffix ? ` ${suffix}` : ''}</Text>
    </View>
  );
}
