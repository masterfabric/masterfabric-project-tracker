import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LoadingState, User } from '../types';
import type { AuthUser } from '../services/mf-go-api';
import { useDeviceStore } from './device-store';

/** mf-go session for token refresh */
export interface MfGoSession {
  userId: string;
  refreshToken: string;
}

interface AppState {
  // App state
  isFirstLaunch: boolean;
  isAppReady: boolean;
  /** True after splash has routed (boot/splash phase complete) */
  splashCompleted: boolean;

  // User state
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;

  /** mf-go session (userId + refreshToken) for token refresh */
  mfGoSession: MfGoSession | null;

  // UI state
  loadingState: LoadingState;
  error: string | null;
  /** Bottom tab: org team chat — only true when user has ≥1 organization (not persisted). */
  showOrgMessagesTab: boolean;

  // Actions
  setFirstLaunch: (isFirst: boolean) => void;
  setAppReady: (ready: boolean) => void;
  setSplashCompleted: (completed: boolean) => void;
  setUser: (user: User | null) => void;
  setAuthToken: (token: string | null) => void;
  setMfGoSession: (session: MfGoSession | null) => void;
  /** Set mf-go auth (token + user + session) after login/register */
  setMfGoAuth: (payload: { accessToken: string; refreshToken: string; user: AuthUser }) => void;
  setLoadingState: (state: LoadingState) => void;
  setError: (error: string | null) => void;
  setShowOrgMessagesTab: (show: boolean) => void;
  logout: () => void;
  reset: () => void;
}

const initialState = {
  isFirstLaunch: true,
  isAppReady: false,
  splashCompleted: false,
  user: null,
  isAuthenticated: false,
  authToken: null,
  mfGoSession: null,
  loadingState: 'idle' as LoadingState,
  error: null,
  showOrgMessagesTab: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setFirstLaunch: (isFirst: boolean) => 
        set({ isFirstLaunch: isFirst }),
      
      setAppReady: (ready: boolean) => 
        set({ isAppReady: ready }),

      setSplashCompleted: (completed: boolean) =>
        set({ splashCompleted: completed }),

      setUser: (user: User | null) => 
        set({ 
          user, 
          isAuthenticated: !!user 
        }),
      
      setAuthToken: (token: string | null) =>
        set({
          authToken: token,
          isAuthenticated: !!token,
        }),

      setMfGoSession: (mfGoSession: MfGoSession | null) =>
        set({ mfGoSession }),

      setMfGoAuth: (payload) =>
        set({
          authToken: payload.accessToken,
          mfGoSession: {
            userId: payload.user.id,
            refreshToken: payload.refreshToken,
          },
          user: {
            id: payload.user.id,
            email: payload.user.email,
            name: payload.user.displayName,
            avatar: payload.user.avatarURL || undefined,
            role: payload.user.role,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          isAuthenticated: true,
        }),

      setLoadingState: (loadingState: LoadingState) =>
        set({ loadingState }),
      
      setError: (error: string | null) => 
        set({ error }),

      setShowOrgMessagesTab: (show: boolean) => set({ showOrgMessagesTab: show }),
      
      logout: () => {
        useDeviceStore.getState().resetForLogout();
        set({
          user: null,
          authToken: null,
          mfGoSession: null,
          isAuthenticated: false,
          error: null,
          showOrgMessagesTab: false,
        });
      },
      
      reset: () => 
        set({ ...initialState }),
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isFirstLaunch: state.isFirstLaunch,
        authToken: state.authToken,
        mfGoSession: state.mfGoSession,
        user: state.user,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<Pick<AppState, 'authToken' | 'mfGoSession' | 'user' | 'isFirstLaunch'>>;
        const hasToken = typeof persisted?.authToken === 'string' && persisted.authToken.length > 0;
        const hasRefreshSession =
          typeof persisted?.mfGoSession?.userId === 'string' &&
          persisted.mfGoSession.userId.length > 0 &&
          typeof persisted?.mfGoSession?.refreshToken === 'string' &&
          persisted.mfGoSession.refreshToken.length > 0;
        const canResumeAuth = hasToken && hasRefreshSession;

        return {
          ...currentState,
          ...persisted,
          // Guard against persisted partial auth (token without refresh session).
          authToken: canResumeAuth ? persisted?.authToken ?? null : null,
          mfGoSession: canResumeAuth ? persisted?.mfGoSession ?? null : null,
          user: canResumeAuth ? persisted?.user ?? null : null,
          isAuthenticated: canResumeAuth,
        };
      },
    }
  )
);
