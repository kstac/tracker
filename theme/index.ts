import {MD3DarkTheme, MD3LightTheme, MD3Theme, useTheme} from 'react-native-paper';
import {MetricCategory} from '@/metrics/registry';

export type ChartTokens = {
  surface: string;
  page: string;
  inkPrimary: string;
  inkSecondary: string;
  inkMuted: string;
  grid: string;
  axis: string;
  series: string[];
  status: {good: string; warning: string; serious: string; critical: string};
  deltaGood: string;
  category: Record<MetricCategory, string>;
};

const LIGHT_SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const DARK_SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

const categoryColors = (s: string[]): Record<MetricCategory, string> => ({
  activity: s[1],
  heart: s[7],
  sleep: s[6],
  recovery: s[2],
  body: s[0],
});

const STATUS = {good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b'};

const LIGHT_CHART: ChartTokens = {
  surface: '#ffffff',
  page: '#f4f6f9',
  inkPrimary: '#0f141b',
  inkSecondary: '#4f5866',
  inkMuted: '#848b96',
  grid: '#e3e7ed',
  axis: '#c5ccd6',
  series: LIGHT_SERIES,
  status: STATUS,
  deltaGood: '#006300',
  category: categoryColors(LIGHT_SERIES),
};

const DARK_CHART: ChartTokens = {
  surface: '#171a1f',
  page: '#0c0e11',
  inkPrimary: '#f3f5f8',
  inkSecondary: '#bcc3ce',
  inkMuted: '#868d98',
  grid: '#262b32',
  axis: '#363c45',
  series: DARK_SERIES,
  status: STATUS,
  deltaGood: '#0ca30c',
  category: categoryColors(DARK_SERIES),
};

export type AppTheme = MD3Theme & {chart: ChartTokens; dark: boolean};

const light: AppTheme = {
  ...MD3LightTheme,
  dark: false,
  roundness: 5,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2563c9',
    onPrimary: '#ffffff',
    primaryContainer: '#d8e6ff',
    onPrimaryContainer: '#001b3f',
    secondary: '#555f71',
    onSecondary: '#ffffff',
    secondaryContainer: '#dfe7f8',
    onSecondaryContainer: '#121c2b',
    tertiary: '#1b8f66',
    tertiaryContainer: '#c4f1dc',
    onTertiaryContainer: '#00210f',
    background: LIGHT_CHART.page,
    surface: LIGHT_CHART.surface,
    surfaceVariant: '#e8ecf2',
    onSurface: LIGHT_CHART.inkPrimary,
    onSurfaceVariant: LIGHT_CHART.inkSecondary,
    outline: '#7a8391',
    outlineVariant: '#dde2e9',
    elevation: {level0: 'transparent', level1: '#ffffff', level2: '#f7f9fc', level3: '#eef3fa', level4: '#ebf1f9', level5: '#e6eef8'},
  },
  chart: LIGHT_CHART,
};

const dark: AppTheme = {
  ...MD3DarkTheme,
  dark: true,
  roundness: 5,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#9fc3ff',
    onPrimary: '#00315f',
    primaryContainer: '#1f4a86',
    onPrimaryContainer: '#d8e6ff',
    secondary: '#bdc7dc',
    onSecondary: '#273141',
    secondaryContainer: '#333c4c',
    onSecondaryContainer: '#dae2f9',
    tertiary: '#8fd8b6',
    tertiaryContainer: '#005139',
    onTertiaryContainer: '#c4f1dc',
    background: DARK_CHART.page,
    surface: DARK_CHART.surface,
    surfaceVariant: '#252a32',
    onSurface: DARK_CHART.inkPrimary,
    onSurfaceVariant: DARK_CHART.inkSecondary,
    outline: '#858d99',
    outlineVariant: '#323843',
    elevation: {level0: 'transparent', level1: '#171a1f', level2: '#1b1f25', level3: '#20252c', level4: '#222830', level5: '#262c35'},
  },
  chart: DARK_CHART,
};

export const THEMES = {light, dark};

export const useAppTheme = () => useTheme<AppTheme>();
