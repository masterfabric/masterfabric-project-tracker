// Use stub only in Expo Go — react-native-onesignal native module doesn't exist there.
// IMPORTANT: Do not use executionEnvironment === 'storeClient' to detect Expo Go. That value is
// shared by Expo Go *and* expo-dev-client development builds (see Expo ExecutionEnvironment docs).
// Using it here incorrectly loaded the stub on real dev builds → no push permission prompt.
function getOneSignalHelper() {
  try {
    const constants = require('expo-constants');
    const c = constants.default ?? constants;
    const isExpoGo = c?.appOwnership === 'expo';
    if (isExpoGo) {
      return require('./onesignal_stub').onesignalHelper;
    }
  } catch {
    // expo-constants not available, use real helper
  }
  return require('./onesignal_helper').onesignalHelper;
}

export const onesignalHelper = getOneSignalHelper();
export type { OneSignalHelper } from './onesignal_helper';
export type {
  OneSignalForegroundWillShowHandler,
  OneSignalInitOptions,
  OneSignalLogLevel,
  OneSignalNotificationClickEvent,
  OneSignalNotificationClickHandler,
  OneSignalPermissionStatus,
  OneSignalSubscriptionState,
} from './types';
