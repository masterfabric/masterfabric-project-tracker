import { useHomeStore } from '@/src/screens/home/store/home-store';
import { useAppStore } from '@/src/shared/store';
import { useLocale } from '@/src/shared/hooks/use-locale';
import { mfGoSettings } from '@/src/shared/services';
import type { Theme as MfGoTheme } from '@/src/shared/services/mf-go-api';
import { StorageService } from '@/src/shared/services/storage';
import { router } from 'expo-router';
import { useTheme } from 'masterfabric-expo-core';
import { useCallback, useMemo } from 'react';
import { Theme } from '../models/settings-models';
import { useSettingsStore } from '../store/settings-store';
import {
    getLanguageOptions,
    getThemeOptions
} from '../utils';

/** Map mf-expo theme to mf-go GraphQL enum */
function toMfGoTheme(t: Theme): MfGoTheme {
  return t.toUpperCase() as MfGoTheme;
}

// Storage constants
const STORAGE_KEYS = {
  THEME: 'app_theme',
  LANGUAGE: 'app_language',
};

export function useSettingsViewModel() {
  const { isLoading, setLoading } = useSettingsStore();
  const { locale, changeLocale } = useLocale();
  const { currentTheme, setTheme: setCoreTheme } = useTheme();
  // System color scheme is available but not used in this hook
  // const systemColorScheme = useColorScheme();
  const { addActivity } = useHomeStore();
  
  // Track settings changes function
  const trackSettingChange = useCallback((
    settingType: 'theme_change' | 'language_change',
    from: string,
    to: string
  ) => {
    // Create activity item based on setting type
    let title = settingType === 'theme_change' ? 'Appearance' : 'Language';
    
    const activity = {
      id: Date.now().toString(),
      title,
      timestamp: new Date().toISOString(),
      type: 'settings' as const,
      details: {
        action: settingType,
        from,
        to
      }
    };
    
    // Add activity to store
    addActivity(activity);
  }, [addActivity]);
  
  const isMfGoAuthenticated = useAppStore((s) => s.isAuthenticated && !!s.mfGoSession);

  // Memoize theme options with translations if needed
  const themeOptions = useMemo(() => {
    return getThemeOptions();
  }, []);

  const languageOptions = useMemo(() => {
    return getLanguageOptions();
  }, []);

  // No init overwrite from remote — theme/locale come from ThemeProvider and LocaleProvider
  // (storage). We sync to remote only when user changes settings to avoid flicker.

  // When language changes
  const handleLanguageChange = useCallback(
    async (value: string) => {
      const previousLanguage = locale;
      changeLocale(value);
      trackSettingChange('language_change', previousLanguage, value);
      StorageService.setItem(STORAGE_KEYS.LANGUAGE, value);
      if (isMfGoAuthenticated) {
        try {
          await mfGoSettings.updateMySettings({ language: value });
        } catch {
          // Local change still applied
        }
      }
    },
    [locale, changeLocale, trackSettingChange, isMfGoAuthenticated]
  );

  // When theme changes: apply immediately (no overlay), sync to remote in background
  const handleThemeChange = useCallback(
    async (value: Theme) => {
      const previousTheme = currentTheme;
      await setCoreTheme(value);
      trackSettingChange('theme_change', previousTheme, value);
      StorageService.setItem(STORAGE_KEYS.THEME, value);
      if (isMfGoAuthenticated) {
        mfGoSettings.updateMySettings({ theme: toMfGoTheme(value) }).catch(() => {
          // Local change already applied; sync failed silently
        });
      }
    },
    [currentTheme, setCoreTheme, trackSettingChange, isMfGoAuthenticated]
  );

  const isThemeSelected = useCallback((targetTheme: Theme): boolean => {
    return currentTheme === targetTheme;
  }, [currentTheme]);

  // Navigation functions
  const navigateBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, []);

  const navigateToHome = useCallback(() => {
    router.replace('/(tabs)');
  }, []);

  return {
    isLoading,
    // Language settings
    currentLanguage: locale,
    languageOptions,
    handleLanguageChange,
    // Theme settings
    selectedTheme: currentTheme,
    themeOptions,
    handleThemeChange,
    isThemeSelected,
    // Navigation
    navigateBack,
    navigateToHome,
  };
}
