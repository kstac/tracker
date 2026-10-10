import {createContext, ReactNode, useCallback, useContext, useEffect, useState} from 'react';
import {useColorScheme} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppTheme, THEMES} from '@/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme-preference';

type Ctx = {preference: ThemePreference; setPreference: (p: ThemePreference) => void; theme: AppTheme};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemePreferenceProvider({children}: {children: (theme: AppTheme) => ReactNode}) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
    });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    AsyncStorage.setItem(STORAGE_KEY, p);
  }, []);

  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const theme = THEMES[scheme];
  return <ThemeCtx.Provider value={{preference, setPreference, theme}}>{children(theme)}</ThemeCtx.Provider>;
}

export function useThemePreference() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useThemePreference must be used inside ThemePreferenceProvider');
  return ctx;
}
