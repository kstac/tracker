import 'react-native-reanimated';
import '@/lib/backgroundSync';
import {DarkTheme, DefaultTheme, Stack, ThemeProvider} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {PaperProvider} from 'react-native-paper';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppDataProvider} from '@/providers/AppData';
import {ThemePreferenceProvider} from '@/providers/ThemePreference';
import {AppTheme} from '@/theme';

function navThemeFor(theme: AppTheme) {
  const base = theme.dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.background,
      text: theme.colors.onSurface,
      border: theme.chart.grid,
    },
  };
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        {(theme) => (
          <PaperProvider theme={theme}>
            <ThemeProvider value={navThemeFor(theme)}>
              <AppDataProvider>
                <StatusBar style={theme.dark ? 'light' : 'dark'} />
                <Stack screenOptions={{headerShadowVisible: false, headerTitleStyle: {fontWeight: '600'}}}>
                  <Stack.Screen name="(tabs)" options={{headerShown: false}} />
                  <Stack.Screen name="metric/[id]" options={{title: ''}} />
                  <Stack.Screen name="tag/[id]" options={{title: ''}} />
                  <Stack.Screen name="garmin-login" options={{title: 'Sign in to Garmin', presentation: 'modal'}} />
                  <Stack.Screen name="+not-found" options={{headerShown: false}} />
                </Stack>
              </AppDataProvider>
            </ThemeProvider>
          </PaperProvider>
        )}
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}
