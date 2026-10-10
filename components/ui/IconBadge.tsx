import {View} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type Props = {icon: string; color: string; size?: number};

export default function IconBadge({icon, color, size = 36}: Props) {
  return (
    <View style={{width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center'}}>
      <MaterialCommunityIcons name={icon as keyof typeof MaterialCommunityIcons.glyphMap} size={size * 0.55} color={color} />
    </View>
  );
}
