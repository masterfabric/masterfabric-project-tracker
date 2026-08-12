import type { SessionStorage } from "mf-tracker-client";

type MemSession = {
  accessToken: string | null;
  refreshToken: string | null;
  userJson: string | null;
};

const mem: MemSession = {
  accessToken: null,
  refreshToken: null,
  userJson: null,
};

const ORG = "mf.desktop.orgId";
const PROJECT = "mf.desktop.projectId";
const VIEW = "mf.desktop.viewMode";

function desktopApi() {
  return typeof window !== "undefined" ? window.mfDesktop : undefined;
}

/** Hydrate in-memory session from Electron safeStorage (call at boot). */
export async function hydrateDesktopSession(): Promise<void> {
  const api = desktopApi();
  if (!api) return;
  const session = await api.session.get();
  if (!session) return;
  mem.accessToken = session.accessToken;
  mem.refreshToken = session.refreshToken;
  mem.userJson = session.userJson;
}

export const sessionStorageAdapter: SessionStorage = {
  getAccessToken: () => mem.accessToken,
  getRefreshToken: () => mem.refreshToken,
  getUserJson: () => mem.userJson,
  setSession: (access, refresh, userJson) => {
    mem.accessToken = access;
    mem.refreshToken = refresh;
    mem.userJson = userJson;
    void desktopApi()?.session.set({
      accessToken: access,
      refreshToken: refresh,
      userJson,
    });
  },
  clearSession: () => {
    mem.accessToken = null;
    mem.refreshToken = null;
    mem.userJson = null;
    void desktopApi()?.session.clear();
  },
};

/** Non-secret workspace prefs stay in localStorage (renderer). */
export const storage = {
  getAccessToken: () => sessionStorageAdapter.getAccessToken(),
  getRefreshToken: () => sessionStorageAdapter.getRefreshToken(),
  getUserJson: () => sessionStorageAdapter.getUserJson(),
  setSession: (access: string, refresh: string, userJson: string) =>
    sessionStorageAdapter.setSession(access, refresh, userJson),
  clearSession: () => sessionStorageAdapter.clearSession(),
  getOrgId: () =>
    typeof window === "undefined" ? null : localStorage.getItem(ORG),
  setOrgId: (id: string | null) => {
    if (!id) localStorage.removeItem(ORG);
    else localStorage.setItem(ORG, id);
  },
  getProjectId: () =>
    typeof window === "undefined" ? null : localStorage.getItem(PROJECT),
  setProjectId: (id: string | null) => {
    if (!id) localStorage.removeItem(PROJECT);
    else localStorage.setItem(PROJECT, id);
  },
  getViewMode: () =>
    typeof window === "undefined" ? null : localStorage.getItem(VIEW),
  setViewMode: (mode: string) => localStorage.setItem(VIEW, mode),
};
