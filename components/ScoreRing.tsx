import {View} from 'react-native';
import Svg, {Circle, Defs, LinearGradient, Stop} from 'react-native-svg';
import {Text} from 'react-native-paper';
import {ScoreLabel} from '@/insights';
import {useAppTheme} from '@/theme';

export function scoreColor(label: ScoreLabel, status: {good: string; warning: string; serious: string; critical: string}) {
  if (label === 'Optimal' || label === 'Good') return status.good;
  if (label === 'Fair') return status.warning;
  return status.serious;
}

type Props = {value: number | null; label?: ScoreLabel; title: string; size?: number; calibrating?: boolean; stroke?: number};

export default function ScoreRing({value, label, title, size = 96, calibrating, stroke}: Props) {
  const {chart} = useAppTheme();
  const width = stroke ?? Math.max(7, size * 0.085);
  const r = (size - width) / 2;
  const circumference = 2 * Math.PI * r;
  const fraction = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;
  const color = label ? scoreColor(label, chart.status) : chart.inkMuted;
  const gradientId = `ring-${title}`;
  const big = size >= 120;

  return (
    <View style={{alignItems: 'center'}} accessibilityLabel={`${title} ${value ?? 'not available'}${label ? `, ${label}` : ''}`}>
      <View style={{width: size, height: size}}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.55} />
              <Stop offset="1" stopColor={color} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={chart.grid} strokeWidth={width} fill="none" />
          {fraction > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={`url(#${gradientId})`}
              strokeWidth={width}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circumference * fraction} ${circumference}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </Svg>
        <View style={{position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center'}}>
          <Text variant={big ? 'displaySmall' : 'headlineSmall'} style={{color: chart.inkPrimary, fontWeight: '700'}}>
            {value == null ? '–' : Math.round(value)}
          </Text>
          {big && (
            <Text variant="labelMedium" style={{color: calibrating ? chart.inkMuted : color}}>
              {calibrating ? 'Calibrating' : label ?? 'No data'}
            </Text>
          )}
        </View>
      </View>
      <Text variant={big ? 'titleMedium' : 'labelLarge'} style={{marginTop: 8, color: chart.inkPrimary, fontWeight: '600'}}>{title}</Text>
      {!big && (
        <Text variant="labelSmall" style={{color: calibrating ? chart.inkMuted : chart.inkSecondary}}>
          {calibrating ? 'Calibrating' : label ?? 'No data'}
        </Text>
      )}
    </View>
  );
}
