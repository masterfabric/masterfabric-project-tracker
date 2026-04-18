const fs = require('fs');
const path = require('path');

// Resolve env files from mf-expo/ (this file’s directory), not process.cwd(), so `expo start` works
// when the shell cwd is the monorepo root or another folder.
const MF_EXPO_ROOT = __dirname;

// 1) `.env` with overwrite: Expo CLI (@expo/env) hydrates `process.env` first and gives `.env.development`
// higher priority than `.env`, so without this pass mf-expo/.env never applied for duplicate keys.
// 2) `.env.development` / `.env.local` without overwrite: only fill keys missing after (1) so empty
// placeholders in `.env.development` do not wipe secrets already set in `.env`.
function loadEnvFile(filePath, overwrite = false) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(MF_EXPO_ROOT, filePath);
  const exists = fs.existsSync(fullPath);
  if (!exists) return;
  const content = fs.readFileSync(fullPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (overwrite || !process.env[key]) process.env[key] = value;
      }
    }
  });
}
loadEnvFile('.env', true);
loadEnvFile('.env.development');
loadEnvFile('.env.local');
// Repo root: optional team overrides (wins on conflict)
loadEnvFile(path.join(MF_EXPO_ROOT, '..', 'local.env'), true);

const appJson = require('./app.json');

// OneSignal plugin must be first so native module is linked in development builds (expo run:ios/android).
// Mode must match APNs: local debug builds use sandbox (aps-environment=development). Mapping
// EXPO_PUBLIC_ENVIRONMENT=production → plugin "production" breaks push from dashboard on `expo run:ios`.
// Optional override: EXPO_PUBLIC_ONESIGNAL_MODE=development|production
//
// App ID / public env: **Xcode (local Archive)** — set `EXPO_PUBLIC_ONE_SIGNAL_APP_ID` in `.env` / `.env.local`
// (loaded above) so `extra.oneSignalAppId` is set when Metro bundles or when you run `expo prebuild`.
// **EAS Build** — same keys in Expo dashboard / `eas.json` env for that profile.
const oneSignalModeOverride = process.env.EXPO_PUBLIC_ONESIGNAL_MODE;
const oneSignalPluginMode =
  oneSignalModeOverride === 'production' || oneSignalModeOverride === 'development'
    ? oneSignalModeOverride
    : process.env.EAS_BUILD === 'true' && process.env.EAS_BUILD_PROFILE === 'production'
      ? 'production'
      : 'development';
// appGroupName must match App Group in Apple Developer + NSE entitlements (default: group.{bundleId}.onesignal)
const oneSignalPlugin = [
  'onesignal-expo-plugin',
  {
    mode: oneSignalPluginMode,
    appGroupName: 'group.com.masterfabric.monoExpo.onesignal',
  },
];
const plugins = [
  oneSignalPlugin,
  ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
  '@react-native-community/datetimepicker',
  ...(appJson.expo.plugins || []),
];

/** Set `EXPO_IOS_TEAM_ID` in env (e.g. `.env`) for local Xcode signing / prebuild / EAS — do not commit in app.json */
const iosAppleTeamId = process.env.EXPO_IOS_TEAM_ID;

module.exports = {
  expo: {
    ...appJson.expo,
    ios: {
      ...appJson.expo.ios,
      ...(iosAppleTeamId ? { appleTeamId: iosAppleTeamId } : {}),
    },
    plugins,
    extra: {
      ...(appJson.expo.extra || {}),
      oneSignalAppId: process.env.EXPO_PUBLIC_ONE_SIGNAL_APP_ID || '',
      graphqlUrl: process.env.EXPO_PUBLIC_GRAPHQL_URL || '',
      devGraphqlUrl: process.env.EXPO_PUBLIC_DEV_GRAPHQL_URL || 'http://localhost:8080/graphql',
      /** Numeric App Store ID for `itms-apps://` store links on iOS. Optional: search fallback uses app name. */
      iosAppStoreId: process.env.EXPO_PUBLIC_IOS_APP_STORE_ID || '',
    },
  },
};
