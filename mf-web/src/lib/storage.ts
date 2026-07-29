const ACCESS = "mf.web.accessToken";
const REFRESH = "mf.web.refreshToken";
const USER = "mf.web.user";
const ORG = "mf.web.orgId";
const PROJECT = "mf.web.projectId";
const VIEW = "mf.web.viewMode";

export const storage = {
  getAccessToken: () =>
    typeof window === "undefined" ? null : localStorage.getItem(ACCESS),
  getRefreshToken: () =>
    typeof window === "undefined" ? null : localStorage.getItem(REFRESH),
  getUserJson: () =>
    typeof window === "undefined" ? null : localStorage.getItem(USER),
  setSession: (access: string, refresh: string, userJson: string) => {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
    localStorage.setItem(USER, userJson);
  },
  clearSession: () => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(USER);
  },
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
