import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  safeStorage,
  shell,
  Tray,
} from "electron";
import { join } from "path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { autoUpdater } from "electron-updater";

const isDev = !app.isPackaged;

const SESSION_FILE = "session.enc";
const PREFS_FILE = "prefs.json";

type EncryptedSession = {
  accessToken: string;
  refreshToken: string;
  userJson: string;
};

type WindowBounds = { x: number; y: number; width: number; height: number };

type Prefs = {
  graphqlUrl?: string;
  hideToTray?: boolean;
  githubRepo?: string;
  githubToken?: string;
  /** Native OS notifications for "assigned to you" / "due soon" — default on. */
  notificationsEnabled?: boolean;
  /** Remembered main-window geometry, restored on next launch. */
  windowBounds?: WindowBounds;
  windowMaximized?: boolean;
};

/** App-level actions dispatched from the native menu to the renderer. */
export type MenuAction =
  | "new-issue"
  | "command-palette"
  | "settings"
  | "shortcuts-help"
  | "toggle-focus-timer"
  | "view-list"
  | "view-board"
  | "view-timeline";

let mainWindow: BrowserWindow | null = null;
let dashboardWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Single instance: focus the existing window instead of spawning a second
// app icon/process — standard desktop-app behavior (avoid duplicate tray icons).
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) mainWindow = createMainWindow();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function supportDir(): string {
  const dir = join(app.getPath("userData"), "mf-desktop");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionPath(): string {
  return join(supportDir(), SESSION_FILE);
}

function prefsPath(): string {
  return join(supportDir(), PREFS_FILE);
}

function readPrefs(): Prefs {
  try {
    if (!existsSync(prefsPath())) return { hideToTray: true };
    return JSON.parse(readFileSync(prefsPath(), "utf8")) as Prefs;
  } catch {
    return { hideToTray: true };
  }
}

function writePrefs(prefs: Prefs): void {
  writeFileSync(prefsPath(), JSON.stringify(prefs, null, 2), "utf8");
}

function encryptSession(session: EncryptedSession): void {
  if (!safeStorage.isEncryptionAvailable()) {
    writeFileSync(sessionPath(), JSON.stringify(session), "utf8");
    return;
  }
  const blob = safeStorage.encryptString(JSON.stringify(session));
  writeFileSync(sessionPath(), blob);
}

function decryptSession(): EncryptedSession | null {
  if (!existsSync(sessionPath())) return null;
  try {
    const raw = readFileSync(sessionPath());
    if (safeStorage.isEncryptionAvailable()) {
      const json = safeStorage.decryptString(raw);
      return JSON.parse(json) as EncryptedSession;
    }
    return JSON.parse(raw.toString("utf8")) as EncryptedSession;
  } catch {
    return null;
  }
}

function clearSessionFile(): void {
  if (!existsSync(sessionPath())) return;
  try {
    unlinkSync(sessionPath());
  } catch {
    writeFileSync(sessionPath(), "");
  }
}

function preloadPath(): string {
  return join(__dirname, "../preload/index.js");
}

/** Dev: mf-desktop/resources; packaged: files copied into app root next to out/ */
function resourceFile(...parts: string[]): string {
  return join(__dirname, "../../resources", ...parts);
}

function windowIcon(): Electron.NativeImage | undefined {
  // Dock/taskbar branding for Linux/Windows; macOS uses the bundled .icns.
  if (process.platform === "darwin") return undefined;
  const path = resourceFile("icon.png");
  if (!existsSync(path)) return undefined;
  return nativeImage.createFromPath(path);
}

function createMainWindow(): BrowserWindow {
  const prefs = readPrefs();
  const bounds = prefs.windowBounds;

  const win = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 840,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "MF Project Tracker",
    icon: windowIcon(),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => {
    if (prefs.windowMaximized) win.maximize();
    win.show();
  });

  // Remember window geometry across launches (debounced — resize/move fire rapidly).
  let boundsSaveTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSaveBounds = () => {
    if (boundsSaveTimer) clearTimeout(boundsSaveTimer);
    boundsSaveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const isMaximized = win.isMaximized();
      const next = readPrefs();
      if (!isMaximized) {
        const b = win.getBounds();
        next.windowBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
      }
      next.windowMaximized = isMaximized;
      writePrefs(next);
    }, 400);
  };
  win.on("resize", scheduleSaveBounds);
  win.on("move", scheduleSaveBounds);
  win.on("maximize", scheduleSaveBounds);
  win.on("unmaximize", scheduleSaveBounds);

  win.on("close", (event) => {
    const p = readPrefs();
    if (!isQuitting && p.hideToTray !== false) {
      event.preventDefault();
      win.hide();
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

function createDashboardWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: true,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: "Dashboard",
    icon: windowIcon(),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && process.env["ELECTRON_RENDERER_URL"]) {
    void win.loadURL(
      `${process.env["ELECTRON_RENDERER_URL"]}#/dashboard-widget`,
    );
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"), {
      hash: "/dashboard-widget",
    });
  }

  win.on("closed", () => {
    dashboardWindow = null;
  });

  return win;
}

function trayIcon(): Electron.NativeImage {
  // Filename must end with "Template" so Electron picks trayTemplate@2x.png on retina
  // and macOS treats it as a menu-bar template (black + alpha, system-tinted).
  const templatePath = resourceFile("trayTemplate.png");
  const colorPath = resourceFile("icon.png");
  const path =
    process.platform === "darwin" && existsSync(templatePath)
      ? templatePath
      : colorPath;

  if (existsSync(path)) {
    const img = nativeImage.createFromPath(path);
    if (!img.isEmpty()) {
      if (process.platform === "darwin" && path === templatePath) {
        img.setTemplateImage(true);
      }
      return img;
    }
  }

  return nativeImage.createEmpty();
}

function buildTray(): Tray {
  const t = new Tray(trayIcon());
  t.setToolTip("MF Project Tracker");
  const menu = Menu.buildFromTemplate([
    {
      label: "Show Window",
      click: () => ensureMainWindow(),
    },
    {
      label: "Pin Desktop Dashboard",
      click: () => showPinnedDashboard(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  t.setContextMenu(menu);
  t.on("click", () => {
    if (!mainWindow) mainWindow = createMainWindow();
    if (mainWindow.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow.show();
    }
  });
  return t;
}

/** Show + focus the main window, creating it first if it was fully closed. */
function ensureMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindow();
  mainWindow.show();
  mainWindow.focus();
  return mainWindow;
}

/** Bring the app to front, then hand the action off to the renderer. */
function sendMenuAction(action: MenuAction): void {
  const win = ensureMainWindow();
  win.webContents.send("menu:action", action);
}

function showPinnedDashboard(): void {
  if (dashboardWindow) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }
  dashboardWindow = createDashboardWindow();
}

/** Standard File/Edit/View/Window/Help app menu — not just a tray-only app. */
function buildAppMenu(): Menu {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings…",
          accelerator: "Cmd+,",
          click: () => sendMenuAction("settings"),
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  const fileSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: "New Issue",
      accelerator: "CmdOrCtrl+N",
      click: () => sendMenuAction("new-issue"),
    },
    {
      label: "Command Palette…",
      accelerator: "CmdOrCtrl+K",
      click: () => sendMenuAction("command-palette"),
    },
    { type: "separator" },
    { label: "Pin Desktop Dashboard", click: () => showPinnedDashboard() },
    { type: "separator" },
  ];
  if (isMac) {
    fileSubmenu.push({ role: "close" });
  } else {
    fileSubmenu.push(
      {
        label: "Settings…",
        accelerator: "CmdOrCtrl+,",
        click: () => sendMenuAction("settings"),
      },
      { type: "separator" },
      { role: "quit" },
    );
  }
  template.push({ label: "File", submenu: fileSubmenu });

  template.push({
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  });

  template.push({
    label: "View",
    submenu: [
      {
        label: "List View",
        accelerator: "CmdOrCtrl+1",
        click: () => sendMenuAction("view-list"),
      },
      {
        label: "Board View",
        accelerator: "CmdOrCtrl+2",
        click: () => sendMenuAction("view-board"),
      },
      {
        label: "Timeline View",
        accelerator: "CmdOrCtrl+3",
        click: () => sendMenuAction("view-timeline"),
      },
      { type: "separator" },
      {
        label: "Toggle Focus Timer",
        accelerator: "CmdOrCtrl+Shift+F",
        click: () => sendMenuAction("toggle-focus-timer"),
      },
      { type: "separator" },
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  });

  const windowSubmenu: Electron.MenuItemConstructorOptions[] = [
    { role: "minimize" },
  ];
  if (isMac) {
    windowSubmenu.push({ role: "zoom" }, { type: "separator" }, { role: "front" });
  } else {
    windowSubmenu.push({ role: "close" });
  }
  template.push({ label: "Window", submenu: windowSubmenu });

  template.push({
    label: "Help",
    role: "help",
    submenu: [
      {
        label: "Keyboard Shortcuts",
        accelerator: "CmdOrCtrl+/",
        click: () => sendMenuAction("shortcuts-help"),
      },
      { type: "separator" },
      {
        label: "Check for Updates…",
        click: () => {
          if (isDev) return;
          void autoUpdater.checkForUpdates().catch(() => undefined);
        },
      },
      { type: "separator" },
      {
        label: "MasterFabric on GitHub",
        click: () =>
          void shell.openExternal(
            "https://github.com/masterfabric-mobile/masterfabric-project-tracker",
          ),
      },
    ],
  });

  return Menu.buildFromTemplate(template);
}

function registerIpc(): void {
  ipcMain.handle("session:get", () => decryptSession());
  ipcMain.handle("session:set", (_e, session: EncryptedSession) => {
    encryptSession(session);
    return true;
  });
  ipcMain.handle("session:clear", () => {
    clearSessionFile();
    return true;
  });

  ipcMain.handle("prefs:get", () => readPrefs());
  ipcMain.handle("prefs:set", (_e, next: Prefs) => {
    const merged: Prefs = { ...readPrefs(), ...next };
    if (Object.prototype.hasOwnProperty.call(next, "githubRepo")) {
      if (!next.githubRepo?.trim()) delete merged.githubRepo;
    }
    if (Object.prototype.hasOwnProperty.call(next, "githubToken")) {
      if (!next.githubToken?.trim()) delete merged.githubToken;
    }
    writePrefs(merged);
    return readPrefs();
  });

  ipcMain.handle("shell:openExternal", (_e, url: string) => {
    void shell.openExternal(url);
    return true;
  });

  ipcMain.handle("app:showMain", () => {
    if (!mainWindow) mainWindow = createMainWindow();
    mainWindow.show();
    mainWindow.focus();
    return true;
  });

  ipcMain.handle("app:showDashboard", () => {
    if (dashboardWindow) {
      dashboardWindow.show();
      dashboardWindow.focus();
      return true;
    }
    dashboardWindow = createDashboardWindow();
    return true;
  });

  ipcMain.handle("app:quit", () => {
    isQuitting = true;
    app.quit();
    return true;
  });

  ipcMain.handle("app:platform", () => process.platform);

  ipcMain.handle(
    "notifications:show",
    (_e, payload: { id: string; title: string; body: string }) => {
      if (!Notification.isSupported()) return false;
      const notification = new Notification({
        title: payload.title,
        body: payload.body,
      });
      notification.on("click", () => {
        const win = ensureMainWindow();
        win.webContents.send("notification:click", payload.id);
      });
      notification.show();
      return true;
    },
  );

  ipcMain.handle("updater:check", async () => {
    if (isDev) return { ok: false, reason: "dev" };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, updateInfo: result?.updateInfo ?? null };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  });
}

app.whenReady().then(() => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.masterfabric.projectTracker.desktop");
  }

  if (process.platform === "darwin" && app.dock) {
    const dockIcon = resourceFile("icon.png");
    if (existsSync(dockIcon)) {
      app.dock.setIcon(nativeImage.createFromPath(dockIcon));
    }
  }

  registerIpc();
  Menu.setApplicationMenu(buildAppMenu());
  mainWindow = createMainWindow();
  tray = buildTray();

  // Global (works even when unfocused) — summon/dismiss the app like a
  // menu-bar utility, on top of the in-window menu accelerators above.
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      ensureMainWindow();
      return;
    }
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (!isDev) {
    autoUpdater.autoDownload = false;
    void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});

// Keep tray reference so GC does not drop it
void tray;
