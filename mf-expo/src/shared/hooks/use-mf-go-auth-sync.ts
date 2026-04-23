/**
 * Syncs app-store auth state with mf-go GraphQL client.
 * - On 401: attempts token refresh first; updates session + user from payload. Logs out only if refresh fails.
 * - On launch: if mfGoSession exists, refresh before first API call (keeps session alive).
 * - Every 3 min: proactive refresh. Access token lifetime is server-driven (login/refresh `expiresIn`; e.g. Azure may return 900s, not a fixed 5 min).
 * - On app relaunch (foreground): refresh to keep session current.
 */

import { AppState, AppStateStatus } from 'react-native';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import {
  attemptAuthRefresh,
  AUTH_REFRESH_INTERVAL_MS,
} from '../services/auth-refresh-service';
import { setGraphQLAuthErrorHandler, syncMfGoAuthToken } from '../services';

export function useMfGoAuthSync(): void {
  const authToken = useAppStore((s) => s.authToken);
  const mfGoSession = useAppStore((s) => s.mfGoSession);
  const splashCompleted = useAppStore((s) => s.splashCompleted);
  const logout = useAppStore((s) => s.logout);
  const refreshedOnLaunch = useRef(false);

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
