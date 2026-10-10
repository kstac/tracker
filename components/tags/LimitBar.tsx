import {View} from 'react-native';
import {useAppTheme} from '@/theme';

export function limitColor(fraction: number, status: {warning: string; critical: string}, normal: string) {
  if (fraction > 1) return status.critical;
  if (fraction >= 0.8) return status.warning;
  return normal;
}

export default function LimitBar({fraction, color, height = 4}: {fraction: number; color: string; height?: number}) {
  const {chart} = useAppTheme();
  return (
    <View style={{height, borderRadius: height / 2, backgroundColor: chart.grid, overflow: 'hidden'}}>
      <View style={{width: `${Math.max(2, Math.min(100, fraction * 100))}%`, height: '100%', borderRadius: height / 2, backgroundColor: limitColor(fraction, chart.status, color)}} />
    </View>
  );
}
