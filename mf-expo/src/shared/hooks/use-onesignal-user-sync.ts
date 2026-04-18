/**
 * Maps mf-go user id to OneSignal external_id (OneSignal.login) so server-sent pushes
 * (task assignment, due reminders) reach this device. Clears on logout.
 */

import Constants from 'expo-constants';
import { onesignalHelper } from 'masterfabric-expo-core';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { getOneSignalAppId } from '@/src/shared/constants';
import { useAppStore } from '@/src/shared/store';

export function useOneSignalUserSync(): void {
  const mfGoSession = useAppStore((s) => s.mfGoSession);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const lastLoggedId = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (Constants.appOwnership === 'expo') return;
    if (!getOneSignalAppId()?.trim()) return;

    const userId = mfGoSession?.userId?.trim() ?? '';
    const shouldBeLoggedIn = isAuthenticated && userId.length > 0;

    if (!shouldBeLoggedIn) {
      if (lastLoggedId.current != null) {
        lastLoggedId.current = null;
        void onesignalHelper.logout().catch(() => {});
      }
      return;
    }

    if (lastLoggedId.current === userId) return;

    const run = async () => {
      if (!onesignalHelper.isInitialized) return;
      try {
        await onesignalHelper.login(userId);
        lastLoggedId.current = userId;
      } catch {
        /* non-fatal — user can still use the app */
      }
    };

    void run();
  }, [mfGoSession?.userId, isAuthenticated]);
}
