import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

export type DesktopSession = {
  accessToken: string;
  refreshToken: string;
  userJson: string;
};

export type DesktopPrefs = {
  graphqlUrl?: string;
  hideToTray?: boolean;
  /** Linked GitHub repo as `owner/repo` (local desktop prefs only). */
  githubRepo?: string;
  /** Optional GitHub PAT for private repos — stored in userData, never commit. */
  githubToken?: string;
  /** Native OS notifications for "assigned to you" / "due soon" — default on. */
  notificationsEnabled?: boolean;
};

/** App-level actions dispatched from the native menu — mirrors electron/main.ts. */
export type MenuAction =
  | "new-issue"
  | "command-palette"
  | "settings"
  | "shortcuts-help"
  | "toggle-focus-timer"
  | "view-list"
  | "view-board"
  | "view-timeline";

export type NotificationPayload = { id: string; title: string; body: string };

const api = {
  session: {
    get: (): Promise<DesktopSession | null> =>
      ipcRenderer.invoke("session:get"),
    set: (session: DesktopSession): Promise<boolean> =>
      ipcRenderer.invoke("session:set", session),
    clear: (): Promise<boolean> => ipcRenderer.invoke("session:clear"),
  },
  prefs: {
    get: (): Promise<DesktopPrefs> => ipcRenderer.invoke("prefs:get"),
    set: (prefs: DesktopPrefs): Promise<DesktopPrefs> =>
      ipcRenderer.invoke("prefs:set", prefs),
  },
  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke("shell:openExternal", url),
  showMain: (): Promise<boolean> => ipcRenderer.invoke("app:showMain"),
  showDashboard: (): Promise<boolean> =>
    ipcRenderer.invoke("app:showDashboard"),
  quit: (): Promise<boolean> => ipcRenderer.invoke("app:quit"),
  platform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke("app:platform"),
  checkForUpdates: (): Promise<{
    ok: boolean;
    reason?: string;
    updateInfo?: unknown;
  }> => ipcRenderer.invoke("updater:check"),
  menu: {
    /** Subscribe to native menu actions (Cmd+N, Cmd+K, Cmd+, …). Returns an unsubscribe fn. */
    onAction: (cb: (action: MenuAction) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, action: MenuAction) => cb(action);
      ipcRenderer.on("menu:action", listener);
      return () => ipcRenderer.removeListener("menu:action", listener);
    },
  },
  notifications: {
    show: (payload: NotificationPayload): Promise<boolean> =>
      ipcRenderer.invoke("notifications:show", payload),
    /** Subscribe to clicks on a native notification (main process re-focuses the window first). */
    onClick: (cb: (id: string) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, id: string) => cb(id);
      ipcRenderer.on("notification:click", listener);
      return () => ipcRenderer.removeListener("notification:click", listener);
    },
  },
};

contextBridge.exposeInMainWorld("mfDesktop", api);

export type MfDesktopApi = typeof api;
