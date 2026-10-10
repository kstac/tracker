import {ReactNode} from 'react';
import {Pressable, StyleProp, View, ViewStyle} from 'react-native';
import {Text} from 'react-native-paper';
import IconBadge from '@/components/ui/IconBadge';
import {useAppTheme} from '@/theme';

type PanelProps = {children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; padded?: boolean};

export function Panel({children, onPress, style, padded = true}: PanelProps) {
  const {chart, colors} = useAppTheme();
  const base: ViewStyle = {
    backgroundColor: chart.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: padded ? 16 : 0,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} android_ripple={{color: colors.surfaceVariant}} style={({pressed}) => [base, style, pressed && {opacity: 0.92}]}>
      {children}
    </Pressable>
  );
}

type HeaderProps = {title: string; subtitle?: string; icon?: string; color?: string; right?: ReactNode};

export function PanelHeader({title, subtitle, icon, color, right}: HeaderProps) {
  const {chart} = useAppTheme();
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12}}>
      {icon && <IconBadge icon={icon} color={color ?? chart.series[0]} />}
      <View style={{flex: 1}}>
        <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>{title}</Text>
        {subtitle ? <Text variant="bodySmall" style={{color: chart.inkSecondary}}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({title, right}: {title: string; right?: ReactNode}) {
  const {chart} = useAppTheme();
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 12, marginBottom: 8}}>
      <Text variant="labelLarge" style={{color: chart.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.8}}>{title}</Text>
      {right}
    </View>
  );
}
