/**
 * Splash view model — simple, efficient flow:
 * 1. Fetch app config (mf-go appSettings)
 * 2. Check onboarding status
 * 3. Enforce minimum display time for branding
 * 4. Route based on config + onboarding
 */

import { navigationUtils } from '@/src/navigation/utils';
import { t } from '@/src/shared/i18n';
import { useAppStore } from '@/src/shared/store';
import { fetchAppConfig, getCustomConfig } from '@/src/shared/services/app-config-service';
import { router } from 'expo-router';
import { shouldShowOnboarding } from 'masterfabric-expo-core';
import { useEffect, useState } from 'react';
import { useSplashStore } from '../store/splash-store';

const MIN_DISPLAY_MS = 600; // Brief branding moment; avoid flash

export function useSplashViewModel() {
  const [isReady, setIsReady] = useState(false);
  const { setAppConfig, setLoadingMessage } = useSplashStore();

  useEffect(() => {
    initializeAndRoute();
  }, []);

  const initializeAndRoute = async () => {
    const start = Date.now();
    setLoadingMessage(t('splash.loading.app-config'));

    const [appConfig, showOnboarding] = await Promise.all([
      fetchAppConfig().catch(() => null),
      shouldShowOnboarding(),
    ]);
    if (appConfig) setAppConfig(appConfig);

    setLoadingMessage(t('splash.loading.auth'));

    const elapsed = Date.now() - start;
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    await new Promise((r) => setTimeout(r, remaining));

    setLoadingMessage(t('splash.loading.finalize'));
    setIsReady(true);
    await route(appConfig ?? undefined, showOnboarding);
  };

  const route = async (
    config?: Awaited<ReturnType<typeof fetchAppConfig>>,
    showOnboarding?: boolean
  ) => {
    const maintenance = config?.custom
      ? getCustomConfig(config, 'app.maintenance') === 'true'
      : false;

    if (maintenance) return;

    useAppStore.getState().setSplashCompleted(true);

    try {
      if (showOnboarding) {
        router.push('/onboarding');
      } else {
        navigationUtils.replace('(tabs)');
      }
    } catch {
      navigationUtils.replace('(tabs)');
    }

    // OneSignal + ATT: app/_layout.tsx (init order: push permission, then ATT after interactions).
  };

  return { isReady };
}
