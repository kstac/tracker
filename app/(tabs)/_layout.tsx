import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {ColorValue} from 'react-native';
import {Tabs} from 'expo-router/js-tabs';
import {useAppTheme} from '@/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function icon(name: IconName) {
  return function TabIcon({color, size}: {color: ColorValue; size: number}) {
    return <MaterialCommunityIcons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const theme = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.chart.inkMuted,
        headerShadowVisible: false,
        headerTitleStyle: {fontWeight: '700', fontSize: 22},
        headerStyle: {backgroundColor: theme.chart.page},
        tabBarStyle: {backgroundColor: theme.chart.surface, borderTopColor: theme.colors.outlineVariant, paddingTop: 4},
        tabBarLabelStyle: {fontSize: 12, fontWeight: '600'},
        sceneStyle: {backgroundColor: theme.chart.page},
      }}
    >
      <Tabs.Screen name="index" options={{title: 'Today', headerShown: false, tabBarIcon: icon('white-balance-sunny')}} />
      <Tabs.Screen name="trends" options={{title: 'Trends', tabBarIcon: icon('chart-line')}} />
      <Tabs.Screen name="insights" options={{title: 'Insights', tabBarIcon: icon('lightbulb-on-outline')}} />
      <Tabs.Screen name="settings" options={{title: 'Settings', tabBarIcon: icon('cog-outline')}} />
    </Tabs>
  );
}
