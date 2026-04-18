/**
 * App Tracking Transparency (ATT) — iOS 14+ IDFA gating before analytics / messaging SDKs
 * that may read the advertising identifier. See https://docs.expo.dev/versions/latest/sdk/tracking-transparency/
 *
 * **Do not** statically or dynamically import `expo-tracking-transparency` until we know the native
 * module exists. Its entry file calls `requireNativeModule('ExpoTrackingTransparency')` at load time,
 * which throws in **Expo Go** and other binaries without the module. We gate on
 * `requireOptionalNativeModule` first.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

let attRequestStarted = false;

const NATIVE_MODULE_NAME = 'ExpoTrackingTransparency';

/**
 * If ATT applies and status is still undetermined, shows the system prompt once per install.
 * Safe on Android / web (no-op). No-op when the native module is absent (Expo Go, etc.).
 */
export async function requestAppTrackingTransparencyIfNeeded(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  if (requireOptionalNativeModule(NATIVE_MODULE_NAME) == null) {
    return;
  }

  if (attRequestStarted) return;
  attRequestStarted = true;

  try {
    const ATT = await import('expo-tracking-transparency');
    if (!ATT.isAvailable()) return;
    const current = await ATT.getTrackingPermissionsAsync();
    if (current.status === ATT.PermissionStatus.UNDETERMINED) {
      await ATT.requestTrackingPermissionsAsync();
    }
  } catch {
    /* Should be rare once native module is present; must not block boot */
  }
}
