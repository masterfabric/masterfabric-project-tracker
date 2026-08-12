/** Pluggable token/user persistence (localStorage, Electron safeStorage, etc.). */
export interface SessionStorage {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  getUserJson: () => string | null;
  setSession: (access: string, refresh: string, userJson: string) => void;
  clearSession: () => void;
}

/** Optional workspace prefs — kept separate from auth tokens. */
export interface WorkspacePrefsStorage {
  getOrgId: () => string | null;
  setOrgId: (id: string | null) => void;
  getProjectId: () => string | null;
  setProjectId: (id: string | null) => void;
  getViewMode: () => string | null;
  setViewMode: (mode: string) => void;
}
