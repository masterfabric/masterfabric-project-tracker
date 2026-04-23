import { ToastContainer } from '@/src/screens/toast-helper/components/toast-container';
import { ErrorBoundary } from '@/src/shared/components/ErrorBoundary';
import { SnackbarQueue } from '@/src/shared/components/SnackbarQueue';
import { LocaleProvider } from '@/src/shared/contexts';
import { useDeviceRegistration } from '@/src/shared/hooks/use-device-registration';
import {
  useMfGoAuthGraphQLBinding,
  useMfGoAuthLifecycle,
} from '@/src/shared/hooks/use-mf-go-auth-sync';
import { useOneSignalUserSync } from '@/src/shared/hooks/use-onesignal-user-sync';
import '@/src/shared/services/logger-service';
import { loadEnvironment } from '@/src/shared/services/environment-service';
import { initPushNotificationHandler } from '@/src/shared/services/push-notification-handler';
import { requestAppTrackingTransparencyIfNeeded } from '@/src/shared/services/tracking-transparency-service';
import { warnIfOneSignalAppIdMissing } from '@/src/shared/services/push-bootstrap-diagnostics';
import { getOneSignalAppId } from '@/src/shared/constants';
import { useAppStore } from '@/src/shared/store';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, type UnknownOutputParams } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import 'firebase/auth';
import {
  buildMasterViewConfig,
  ThemeProvider as MasterViewThemeProvider,
  connectivityHelper,
  initMasterView,
  onesignalHelper,
  useTheme,
} from 'masterfabric-expo-core';
import type { FirebaseConfig } from 'masterfabric-expo-core';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-get-random-values';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * expo-router passes `organization/[id]` params here; react-navigation getId must return string | undefined.
 * `id` may be `string[]` in edge cases — returning it as-is can crash the native stack.
 */
function organizationScreenSingularId(
  _name: string,
  params: UnknownOutputParams
): string | undefined {
  const raw = params.id;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].length > 0) return raw[0];
  return undefined;
}

/** Firebase config from app.config extra (same values as EXPO_PUBLIC_* at bundle time). */
function getFirebaseConfigFromExtra(): Partial<FirebaseConfig> | undefined {
  const fb = Constants.expoConfig?.extra?.firebase as Record<string, string | undefined> | undefined;
  if (!fb?.apiKey || !fb.projectId || !fb.appId) return undefined;
  return {
    apiKey: fb.apiKey,
    authDomain: fb.authDomain,
    projectId: fb.projectId,
    storageBucket: fb.storageBucket,
    messagingSenderId: fb.messagingSenderId,
    appId: fb.appId,
    measurementId: fb.measurementId,
  };
}

/**
 * GraphQL 401 handler + Bearer sync as soon as {@link loadEnvironment} finishes (GFG-80).
 * Stays mounted through the rest of boot so requests during `initMasterView` recover from expired tokens.
 */
function MfGoGraphQLAuthBootstrap() {
  useMfGoAuthGraphQLBinding();
  return null;
}

// Refresh intervals, splash launch refresh, foreground refresh — after `isAppReady` only (no duplicate timers).
// Device registration runs when conditions are met (boot, splash, relaunch).
function AppProviders() {
  useMfGoAuthLifecycle();
  useOneSignalUserSync();
  useDeviceRegistration();
  return null;
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
    },
  },
});

// Navigation wrapper that uses core theme
function NavigationWrapper({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  
  return (
    <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      {children}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const { isAppReady, setAppReady } = useAppStore();
  /** True after AsyncStorage env is applied; GraphQL client URL is trustworthy (parallel with initMasterView). */
  const [graphqlEnvReady, setGraphqlEnvReady] = useState(false);
  
  const [loaded] = useFonts({
    SpaceMono: require('../src/assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Prevent permanent black screen on real device: force show app after timeout
  // (e.g. when Metro is unreachable or initMasterView hangs)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const { isAppReady: ready } = useAppStore.getState();
      if (!ready) {
        console.warn('[RootLayout] App ready timeout – showing UI anyway (check Metro connection on device)');
        SplashScreen.hideAsync();
        setAppReady(true);
      }
    }, 12000);
    return () => clearTimeout(timeout);
  }, [setAppReady]);

  /**
   * OneSignal: official Expo Router pattern — init + requestPermission once fonts are ready,
   * before route screens (see https://documentation.onesignal.com/docs/en/react-native-expo-sdk-setup).
   * Splash must not duplicate init; push listeners register here after init.
   */
  useEffect(() => {
    if (!loaded) return;
    if (Platform.OS === 'web') return;
    if (Constants.appOwnership === 'expo') return;

    /** ATT after push permission (or if OneSignal skipped) so the system prompt is not suppressed. */
    const scheduleIosAtt = () => {
      if (Platform.OS !== 'ios') return;
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          void requestAppTrackingTransparencyIfNeeded();
        }, 1400);
      });
    };

    const appId = getOneSignalAppId();
    if (!appId?.trim()) {
      warnIfOneSignalAppIdMissing();
      scheduleIosAtt();
      return;
    }

    void (async () => {
      try {
        await onesignalHelper.init(appId.trim(), { promptForPush: true, verbose: __DEV__ });
        initPushNotificationHandler();
        const uid = useAppStore.getState().mfGoSession?.userId?.trim();
        if (uid) {
          try {
            await onesignalHelper.login(uid);
          } catch {
            /* useOneSignalUserSync will retry on session updates */
          }
        }
        scheduleIosAtt();
      } catch (e) {
        console.warn('[OneSignal] init failed', e);
        scheduleIosAtt();
      }
    })();
  }, [loaded]);

  useEffect(() => {
    if (!loaded) {
      setGraphqlEnvReady(false);
      return;
    }
    let cancelled = false;
    const firebaseFromExtra = getFirebaseConfigFromExtra();
    // Start connectivity monitoring while app is active
    connectivityHelper.start(5000);
    const envLoaded = loadEnvironment().then(() => {
      if (!cancelled) setGraphqlEnvReady(true);
    });
    Promise.all([
      envLoaded,
      initMasterView({
          appName: 'MF Project Tracker',
          appVersion: '1.2.0',
          environment: __DEV__ ? 'development' : 'production',
          config: buildMasterViewConfig({
            enableActivityTracking: true,
            enableErrorBoundary: true,
            enableThemeSupport: true,
            enableLocalization: true,
            enableLoadingStates: true,
            enableNavigationTracking: true,
            maxActivityItems: 100,
            enableDebugMode: __DEV__,
            enableLogging: __DEV__,
            logLevel: __DEV__ ? 'debug' : 'error',
            enablePlatformFeatures: true,
            enableAccessibility: true,
            enablePermissions: true,
            enableSentry: false, // Disable Sentry for now
            // Firebase: explicit on + env auto-detect (integration-detector); extra.firebase fills config when bundled
            enableFirebase: true,
            enableFirebaseAuth: true,
            enableFirebaseAnalytics: true,
            ...(firebaseFromExtra ? { firebaseConfig: firebaseFromExtra } : {}),
            // Supabase disabled — using mf-go GraphQL backend
            enableSupabase: false,
            enableSupabaseAuth: false,
          }),
          onError: (error: unknown) => {
            console.error('MasterView Error:', error);
          },
          onActivityTracked: (activity) => {
            console.log('Activity Tracked:', activity);
          },
          onThemeChanged: (theme) => {
            console.log('Theme Changed:', theme);
          },
          onLocaleChanged: (locale) => {
            console.log('Locale Changed:', locale);
          },
        }),
    ])
      .then(() => {
        if (cancelled) return;
        // MasterView initialized, app is ready for splash screen
        setAppReady(true);
        SplashScreen.hideAsync();
      })
      .catch((error) => {
        console.error('Failed to initialize MasterView:', error);
        if (cancelled) return;
        // Still proceed with app loading
        setAppReady(true);
        SplashScreen.hideAsync();
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, setAppReady]);

  if (!loaded) {
    return null;
  }

  return (
    <>
      {graphqlEnvReady ? <MfGoGraphQLAuthBootstrap /> : null}
      {isAppReady ? (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ErrorBoundary>
            <LocaleProvider>
              <MasterViewThemeProvider>
                <QueryClientProvider client={queryClient}>
                  <SafeAreaProvider>
                    <AppProviders />
                    <NavigationWrapper>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="splash" />
                        <Stack.Screen name="onboarding" />
                        <Stack.Screen name="settings" />
                        <Stack.Screen name="profile" />
                        <Stack.Screen
                          name="organization/[id]"
                          options={{ headerShown: false }}
                          dangerouslySingular={organizationScreenSingularId}
                        />
                        <Stack.Screen name="organization/[id]/projects" options={{ headerShown: false }} />
                        <Stack.Screen
                          name="organization/[id]/project/[projectId]"
                          options={{ headerShown: false }}
                        />
                        <Stack.Screen name="notifications" />
                        <Stack.Screen name="admin-notifications" />
                        <Stack.Screen name="admin-mail-management" />
                        <Stack.Screen name="admin-otp-mail" />
                        <Stack.Screen name="forgot-password" />
                        <Stack.Screen name="admin-sessions" />
                        <Stack.Screen name="admin-user-management" />
                        <Stack.Screen name="admin-version" />
                        <Stack.Screen name="admin-feedback" />
                        <Stack.Screen name="admin-legal" />
                        <Stack.Screen name="help-faq" />
                        <Stack.Screen name="privacy-policy" />
                        <Stack.Screen name="feedback" />
                        <Stack.Screen
                          name="feedback/[id]"
                          options={{ headerShown: false }}
                          dangerouslySingular={({ params }) => (params as { id?: string })?.id}
                        />
                        <Stack.Screen name="mf-go-auth" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="+not-found" />
                      </Stack>
                      <StatusBar style="auto" />
                      <SnackbarQueue />
                      <ToastContainer />
                    </NavigationWrapper>
                  </SafeAreaProvider>
                </QueryClientProvider>
              </MasterViewThemeProvider>
            </LocaleProvider>
          </ErrorBoundary>
        </GestureHandlerRootView>
      ) : null}
    </>
  );
}
