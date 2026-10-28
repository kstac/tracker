import {ReactNode} from 'react';
import {Pressable, StyleProp, View, ViewStyle} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {Text} from 'react-native-paper';
import IconBadge from '@/components/ui/IconBadge';
import {Panel} from '@/components/ui/Panel';
import {useCardOpen} from '@/lib/collapse';
import {useAppTheme} from '@/theme';

type Props = {
  /** Remembers open or closed under this id. */
  id: string;
  title: string;
  /** Shown under the title while open. */
  subtitle?: string;
  /** Shown under the title while closed, so a closed card still says the one thing that matters. */
  summary?: string;
  summaryColor?: string;
  icon?: string;
  color?: string;
  /** Stays visible open or closed, e.g. the headline number. */
  right?: ReactNode;
  defaultOpen?: boolean;
  /** Tapping the body (not the header) opens a detail screen. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export default function CollapsiblePanel({id, title, subtitle, summary, summaryColor, icon, color, right, defaultOpen = false, onPress, style, children}: Props) {
  const {chart} = useAppTheme();
  const [open, toggle] = useCardOpen(id, defaultOpen);
  const sub = open ? subtitle : summary ?? subtitle;
  return (
    <Panel style={[{paddingVertical: open ? 16 : 12}, style]}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{expanded: open}}
        accessibilityLabel={`${title}, ${open ? 'collapse' : 'expand'}`}
        style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: open ? 12 : 0}}
      >
        {icon && <IconBadge icon={icon} color={color ?? chart.series[0]} />}
        <View style={{flex: 1}}>
          <Text variant="titleMedium" style={{color: chart.inkPrimary, fontWeight: '600'}}>{title}</Text>
          {sub ? <Text variant="bodySmall" style={{color: !open && summaryColor ? summaryColor : chart.inkSecondary}}>{sub}</Text> : null}
        </View>
        {right}
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={chart.inkMuted} />
      </Pressable>
      {open && (onPress ? <Pressable onPress={onPress}>{children}</Pressable> : children)}
    </Panel>
  );
}
