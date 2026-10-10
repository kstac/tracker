import {View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {Text} from 'react-native-paper';
import {formatTagAmount} from '@/insights/tagStats';
import {useAppTheme} from '@/theme';

/** Change in average weekly amount. Going down counts as good when the tag has a limit, otherwise it's neutral. */
export default function TrendBadge({change, unit, reduceIsGood}: {change: number; unit: string | null; reduceIsGood: boolean}) {
  const {chart} = useAppTheme();
  const flat = Math.abs(change) < 0.05;
  let color = chart.inkSecondary;
  if (!flat && reduceIsGood) color = change < 0 ? chart.deltaGood : chart.status.critical;
  const icon = flat ? 'minus' : change > 0 ? 'arrow-top-right' : 'arrow-bottom-right';
  const sign = change > 0 ? '+' : change < 0 ? '−' : '±';
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', backgroundColor: `${color}1a`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2}}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text variant="labelSmall" style={{color}}>{sign}{formatTagAmount(Math.abs(Math.round(change * 10) / 10), unit)} / week</Text>
    </View>
  );
}
