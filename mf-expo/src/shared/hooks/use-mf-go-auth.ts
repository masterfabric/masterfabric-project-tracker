/**
 * mf-go auth: login, register, logout, refresh.
 * Syncs with app-store and GraphQL client.
 * Uses getAuthErrorMessage for user-friendly error display (wrong password, network, etc.).
 * On logout: saves last email for pre-fill, clears saved password.
 */

import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { t } from '../i18n';
import { useAppStore } from '../store';
import { mfGoAuth, refreshAuthTokensSingleFlight, syncMfGoAuthToken } from '../services';
import { authCredentials } from '../services/auth-credentials';
import { resetUserMessageSubscriptionClient } from '../services/user-message-subscription';
import { snackbarService } from '../services/snackbar-service';
import { getAuthErrorMessage } from '../helpers/graphql-error-helper';
import type { LoginPayload } from '../services/mf-go-api';
import { suppressMfGoAuthSignedInPlaceholder } from '../utils/mf-go-auth-signed-in-placeholder-suppress';

export function useMfGoAuth() {
  const { setMfGoAuth, logout: storeLogout, authToken, mfGoSession, user } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOTPLogin, setPendingOTPLogin] = useState<LoginPayload | null>(null);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await mfGoAuth.login(email, password);
        if (payload.otpRequired) {
          setPendingOTPLogin(payload);
          return payload;
        }
        suppressMfGoAuthSignedInPlaceholder();
        setMfGoAuth({
          accessToken: payload.accessToken!,
          refreshToken: payload.refreshToken!,
          user: payload.user,
        });
        syncMfGoAuthToken(payload.accessToken!);
        return payload;
      } catch (e: unknown) {
        setError(getAuthErrorMessage(e));
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [setMfGoAuth]
  );

  const verifyLoginOTP = useCallback(
    async (code: string) => {
      if (!pendingOTPLogin?.loginToken) {
        setError(t('errors.auth.noPendingOtpLogin'));
        return null;
      }
      setIsLoading(true);
      setError(null);
      try {
        const payload = await mfGoAuth.loginVerifyOTP(pendingOTPLogin.loginToken, code);
        suppressMfGoAuthSignedInPlaceholder();
        setMfGoAuth(payload);
        syncMfGoAuthToken(payload.accessToken);
        setPendingOTPLogin(null);
        return payload;
      } catch (e: unknown) {
        setError(getAuthErrorMessage(e));
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [pendingOTPLogin, setMfGoAuth, t]
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await mfGoAuth.register(email, password, displayName);
        suppressMfGoAuthSignedInPlaceholder();
        setMfGoAuth(payload);
        syncMfGoAuthToken(payload.accessToken);
        return payload;
      } catch (e: unknown) {
        setError(getAuthErrorMessage(e));
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [setMfGoAuth]
  );

  const logout = useCallback(async () => {
    const emailToKeep = user?.email ?? '';
    if (emailToKeep) {
      await authCredentials.setLastEmail(emailToKeep);
      await authCredentials.clearSavedPassword();
    }
    resetUserMessageSubscriptionClient();
    if (!authToken || !mfGoSession) {
      storeLogout();
      syncMfGoAuthToken(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await mfGoAuth.logout(mfGoSession.userId, authToken, mfGoSession.refreshToken);
    } catch {
      // Still clear local state on logout failure
    } finally {
      storeLogout();
      syncMfGoAuthToken(null);
      setIsLoading(false);
    }
    snackbarService.show({
      message: t('auth.mfGo.signedOutRedirectSnackbar'),
      type: 'info',
      duration: 3200,
    });
    router.replace('/(tabs)');
  }, [authToken, mfGoSession, storeLogout, user?.email]);

  const refreshTokens = useCallback(async () => {
    if (!mfGoSession?.refreshToken) return null;
    // Share the same single-flight refresh as timers / GraphQL auth recovery (no double rotation).
    return refreshAuthTokensSingleFlight();
  }, [mfGoSession?.refreshToken]);

  return {
    login,
    verifyLoginOTP,
    register,
    logout,
    refreshTokens,
    isLoading,
    error,
    setError,
    isAuthenticated: !!authToken,
    pendingOTPLogin,
    clearPendingOTP: () => setPendingOTPLogin(null),
  };
}
