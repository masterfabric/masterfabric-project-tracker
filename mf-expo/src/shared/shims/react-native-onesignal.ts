/**
 * Metro always resolves `react-native-onesignal` here so we can pick the real native SDK
 * vs the Expo Go stub at runtime (no EXPO_DEV_BUILD env required).
 *
 * - Expo Go: stub (native module missing)
 * - Web: stub (OneSignal RN SDK is not used on web)
 * - Dev client / release builds: real package from node_modules
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function useExpoGoStub(): boolean {
  if (Platform.OS === 'web') return true;
  return Constants.appOwnership === 'expo';
}

// eslint-disable-next-line @typescript-eslint/no-require-imports -- runtime split; path avoids Metro alias recursion
const pkg = useExpoGoStub()
  ? require('../stubs/react-native-onesignal-expo-go')
  : require('../../../node_modules/react-native-onesignal/dist/index.js');

export const LogLevel = pkg.LogLevel;
export const NotificationWillDisplayEvent = pkg.NotificationWillDisplayEvent;
export const OSNotification = pkg.OSNotification;
export const OSNotificationPermission = pkg.OSNotificationPermission;
export const OneSignal = pkg.OneSignal;
export default pkg.OneSignal;
