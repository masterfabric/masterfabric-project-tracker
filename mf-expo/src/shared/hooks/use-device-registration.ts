/**
 * Device registration — multiple conditions, validation, lifecycle (boot, splash, relaunch).
 * Registers device with mf-go when all conditions are met. Devices kept under user.
 */

import { AppState, AppStateStatus } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/app-store';
import { useDeviceStore } from '../store/device-store';
import {
  areConditionsMet,
  type DeviceRegistrationConditions,
  registerDevice,
  fetchUserDevices,
  isCurrentDeviceRegistered,
} from '../services/device-registration-service';
import type { AppLifecyclePhase } from '../store/device-store';

/**
 * Determines lifecycle phase for registration.
 * - boot: first app load
 * - splash: during/after splash (splashCompleted)
 * - relaunch: app returning from background
 */
function getLifecyclePhase(
  conditions: DeviceRegistrationConditions,
  wasBackgrounded: boolean
): AppLifecyclePhase {
  if (wasBackgrounded) return 'relaunch';
  if (conditions.splashCompleted) return 'splash';
  return 'boot';
}

/**
 * Registers device when all conditions are met.
 * Handles boot, splash, relaunch; validates before registering.
 */
export function useDeviceRegistration() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const splashCompleted = useAppStore((s) => s.splashCompleted);
  const userId = useAppStore((s) => s.user?.id);

  const [isAppForeground, setIsAppForeground] = useState(() =>
    typeof AppState?.currentState === 'string'
      ? AppState.currentState === 'active'
      : true
  );

  const wasBackgrounded = useRef(false);
  const registeredThisSession = useRef(false);

  // Track app foreground/background for relaunch
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        wasBackgrounded.current = true;
        setIsAppForeground(false);
      } else if (nextState === 'active') {
        setIsAppForeground(true);
      }
    });
    return () => sub?.remove();
  }, []);

  // Reset registered flag when user changes (logout/login as different user)
  useEffect(() => {
    if (!isAuthenticated) {
      registeredThisSession.current = false;
    }
  }, [isAuthenticated, userId]);

  const conditions: DeviceRegistrationConditions = {
    isAuthenticated,
    isAppReady,
    splashCompleted,
    isAppForeground,
  };

  useEffect(() => {
    if (!areConditionsMet(conditions)) return;

    const phase = getLifecyclePhase(conditions, wasBackgrounded.current);

    // Boot/splash: register once per session when user is authenticated
    if (phase === 'boot' || phase === 'splash') {
      if (registeredThisSession.current) return;

      (async () => {
        const ok = await registerDevice(phase);
        if (ok) {
          registeredThisSession.current = true;
          wasBackgrounded.current = false;
          await fetchUserDevices();
        }
      })();
      return;
    }

    // Relaunch: re-validate or re-register
    if (phase === 'relaunch') {
      (async () => {
        await fetchUserDevices();
        if (!isCurrentDeviceRegistered()) {
          await registerDevice('relaunch');
        }
        wasBackgrounded.current = false;
      })();
    }
  }, [isAuthenticated, isAppReady, splashCompleted, isAppForeground]);
}
