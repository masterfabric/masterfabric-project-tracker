/**
 * Release-visible diagnostics when push (OneSignal) cannot start — e.g. App ID missing at bundle time
 * (empty `.env` when archiving from Xcode, or missing EAS env on cloud builds).
 */

import Constants from 'expo-constants';
import { logger } from './logger';
import { getOneSignalAppId } from '@/src/shared/constants';

let missingOneSignalAppIdLogged = false;

/** Log once per app launch when a native build has no OneSignal App ID at bundle time. */
export function warnIfOneSignalAppIdMissing(): void {
  if (Constants.appOwnership === 'expo') return;
  if (getOneSignalAppId().trim()) return;
  if (missingOneSignalAppIdLogged) return;
  missingOneSignalAppIdLogged = true;
  logger.warnAlways(
    'Push: EXPO_PUBLIC_ONE_SIGNAL_APP_ID is empty — OneSignal will not run. Xcode/local: set it in mf-expo/.env (or env that loads before bundle) and rebuild the JS bundle. EAS: project Environment variables or eas.json. See mf-expo/.env.example.'
  );
}
