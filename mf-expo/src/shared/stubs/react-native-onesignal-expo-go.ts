/**
 * Stub for react-native-onesignal when running in Expo Go.
 * The native module doesn't exist in Expo Go — use a development build for real OneSignal.
 */

export const LogLevel = { Verbose: 6 };

export const OneSignal = {
  LogLevel,
  initialize: () => {},
  Notifications: {
    requestPermission: async () => false,
    getPermissionAsync: async () => false,
    canRequestPermission: async () => false,
    addEventListener: () => () => {},
  },
  User: {
    pushSubscription: {
      optOut: async () => {},
      optIn: async () => {},
      optedIn: false,
    },
  },
  Debug: { setLogLevel: () => {} },
  login: async () => {},
  logout: async () => {},
};

export default OneSignal;
