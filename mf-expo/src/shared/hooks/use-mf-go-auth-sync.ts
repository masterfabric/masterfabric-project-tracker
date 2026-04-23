/**
 * Syncs app-store auth state with mf-go GraphQL client.
 * - On 401: attempts token refresh first; updates session + user from payload. Logs out only if refresh fails.
 * - On launch: if mfGoSession exists, refresh before first API call (keeps session alive).
 * - Every 3 min: proactive refresh. Access token lifetime is server-driven (login/refresh `expiresIn`; e.g. Azure may return 900s, not a fixed 5 min).
 * - On app relaunch (foreground): refresh to keep session current.
 *
 * ## Boot split (GFG-80)
 * GraphQL URL/env is ready only after {@link loadEnvironment} resolves. `initMasterView` runs in parallel
 * until `isAppReady`. To avoid a window with no 401 handler or Bearer header on the client, mount
 * {@link useMfGoAuthGraphQLBinding} as soon as env is loaded; mount {@link useMfGoAuthLifecycle} with
 * the rest of the app after `isAppReady` so refresh intervals are not duplicated.
 */

import { AppState, AppStateStatus } from 'react-native';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import {
  attemptAuthRefresh,
  AUTH_REFRESH_INTERVAL_MS,
} from '../services/auth-refresh-service';
import { setGraphQLAuthErrorHandler, syncMfGoAuthToken } from '../services';

/**
 * Token header, 401 recovery, and defensive session consistency. Safe to mount once env/GraphQL URL
 * is loaded — even before MasterView/`isAppReady` — without starting refresh intervals.
 */
export function useMfGoAuthGraphQLBinding(): void {
  const authToken = useAppStore((s) => s.authToken);
  const mfGoSession = useAppStore((s) => s.mfGoSession);
  const logout = useAppStore((s) => s.logout);

  useEffect(() => {
    syncMfGoAuthToken(authToken);
  }, [authToken]);

  // Defensive guard: never keep an "authenticated" token without a refresh session.
  useEffect(() => {
    if (authToken && !mfGoSession?.refreshToken) {
      logout();
      syncMfGoAuthToken(null);
    }
  }, [authToken, mfGoSession?.refreshToken, logout]);

  useEffect(() => {
    setGraphQLAuthErrorHandler(async () => {
      await attemptAuthRefresh();
    });
    return () => setGraphQLAuthErrorHandler(null);
  }, []);
}

/** Proactive / splash / foreground refresh — mount once; typically after `isAppReady`. */
export function useMfGoAuthLifecycle(): void {
  const mfGoSession = useAppStore((s) => s.mfGoSession);
  const splashCompleted = useAppStore((s) => s.splashCompleted);
  const refreshedOnLaunch = useRef(false);

  // On launch / splash: refresh if we have session (keeps session alive after app restart)
  useEffect(() => {
    if (!splashCompleted || !mfGoSession?.refreshToken || refreshedOnLaunch.current) return;
    refreshedOnLaunch.current = true;
    attemptAuthRefresh().catch(() => {});
  }, [splashCompleted, mfGoSession?.refreshToken]);

  // Every 3 min: proactive refresh — use login/refresh `expiresIn` for actual TTL, not a fixed 5 min
  useEffect(() => {
    if (!mfGoSession?.refreshToken) return;
    const id = setInterval(() => {
      attemptAuthRefresh().catch(() => {});
    }, AUTH_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [mfGoSession?.refreshToken]);

  // On app relaunch (foreground): refresh to keep session current
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && mfGoSession?.refreshToken) {
        attemptAuthRefresh().catch(() => {});
      }
    });
    return () => sub?.remove();
  }, [mfGoSession?.refreshToken]);
}

/** Full sync: binding + lifecycle. Prefer split hooks in root layout (GFG-80). */
export function useMfGoAuthSync(): void {
  useMfGoAuthGraphQLBinding();
  useMfGoAuthLifecycle();
}
