/**
 * OneSignal stub for Expo Go — react-native-onesignal is not available in Expo Go.
 * This stub implements the same interface but never loads the native module.
 */

import type {
  OneSignalForegroundWillShowHandler,
  OneSignalInitOptions,
  OneSignalLogLevel,
  OneSignalNotificationClickEvent,
  OneSignalNotificationClickHandler,
  OneSignalPermissionStatus,
  OneSignalSubscriptionState,
} from './types';

const EXPO_GO_MSG =
  'OneSignal is not supported in Expo Go. Use a development build: npx expo run:ios (or run:android).';

class OneSignalStub {
  get isInitialized(): boolean {
    return false;
  }

  async init(_appId: string, _options?: OneSignalInitOptions): Promise<void> {
    if (__DEV__) console.warn('[OneSignal]', EXPO_GO_MSG);
  }

  async requestPermission(_fallback = false): Promise<boolean> {
    return false;
  }

  async getPermissionAsync(): Promise<OneSignalPermissionStatus> {
    return { granted: false };
  }

  async login(_externalUserId: string): Promise<void> {}

  async logout(): Promise<void> {}

  async setPushDisabled(_disabled: boolean): Promise<void> {}

  async isPushDisabled(): Promise<boolean> {
    return true;
  }

  addForegroundWillShowHandler(_handler: OneSignalForegroundWillShowHandler): () => void {
    return () => {};
  }

  addNotificationClickListener(_handler: OneSignalNotificationClickHandler): () => void {
    return () => {};
  }

  addPermissionChangeListener(_handler: (granted: boolean) => void): () => void {
    return () => {};
  }

  async getSubscriptionState(): Promise<OneSignalSubscriptionState> {
    return {};
  }

  async setLogLevel(_level: OneSignalLogLevel): Promise<void> {}
}

export const onesignalHelper = new OneSignalStub();
