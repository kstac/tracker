import {Pressable, View} from 'react-native';
import {Text} from 'react-native-paper';
import IconBadge from '@/components/ui/IconBadge';
import {useAppTheme} from '@/theme';

type Props = {label: string; value: string; sub?: string; icon: string; color: string; onPress?: () => void};

export default function StatTile({label, value, sub, icon, color, onPress}: Props) {
  const {chart, colors} = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{color: colors.surfaceVariant}}
      style={{flexBasis: '47%', flexGrow: 1, backgroundColor: chart.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.outlineVariant, gap: 10}}
    >
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
        <IconBadge icon={icon} color={color} size={28} />
        <Text variant="labelMedium" numberOfLines={1} style={{color: chart.inkSecondary, flex: 1}}>{label}</Text>
      </View>
      <View>
        <Text variant="titleLarge" style={{color: chart.inkPrimary, fontWeight: '700'}}>{value}</Text>
        {sub ? <Text variant="labelSmall" style={{color: chart.inkMuted}}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
}
