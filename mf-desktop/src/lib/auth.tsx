"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api } from "./api";
import { ensureFreshSession, setSessionInvalidHandler } from "./graphql";
import { isUnreachableApiError } from "./operator-errors";
import { storage } from "./storage";
import type { AuthUser, LoginResult } from "./types";

/** Refresh a bit before typical short access-token TTL (mf-go often ~5m). */
const PROACTIVE_REFRESH_MS = 3 * 60 * 1000;

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  verifyOtp: (loginToken: string, code: string) => Promise<void>;
  logout: () => void;
  applySession: (access: string, refresh: string, user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    storage.clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionInvalidHandler(() => {
      setUser(null);
      toast.error("Session expired — sign in again", {
        description: "Refresh token is no longer valid (server reset or logout).",
      });
    });
    return () => setSessionInvalidHandler(null);
  }, []);

  useEffect(() => {
    const token = storage.getAccessToken();
    const refresh = storage.getRefreshToken();
    const raw = storage.getUserJson();
    // Access without refresh cannot renew — treat as logged out.
    if (token && refresh && raw) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        storage.clearSession();
      }
    } else if (token || refresh || raw) {
      storage.clearSession();
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const ok = await ensureFreshSession();
        // ensureFreshSession clears storage on dead refresh tokens; sync UI.
        if (!cancelled && !ok && !storage.getAccessToken()) {
          setUser(null);
        }
      } catch (err) {
        // Offline / API down / Redis blip: keep the local session for Retry.
        if (!cancelled && isUnreachableApiError(err)) return;
      }
    };

    // Warm session shortly after load, then on an interval.
    void tick();
    const id = window.setInterval(() => void tick(), PROACTIVE_REFRESH_MS);

    const onFocus = () => void tick();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  const applySession = useCallback(
    (access: string, refresh: string, next: AuthUser) => {
      storage.setSession(access, refresh, JSON.stringify(next));
      setUser(next);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password);
      if (
        !result.otpRequired &&
        result.accessToken &&
        result.refreshToken &&
        result.user
      ) {
        applySession(result.accessToken, result.refreshToken, result.user);
      }
      return result;
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const session = await api.register(email, password, displayName);
      applySession(session.accessToken, session.refreshToken, session.user);
    },
    [applySession],
  );

  const verifyOtp = useCallback(
    async (loginToken: string, code: string) => {
      const session = await api.loginVerifyOTP(loginToken, code);
      applySession(session.accessToken, session.refreshToken, session.user);
    },
    [applySession],
  );

  const value = useMemo(
    () => ({
      user,
      ready,
      login,
      register,
      verifyOtp,
      logout,
      applySession,
    }),
    [user, ready, login, register, verifyOtp, logout, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
