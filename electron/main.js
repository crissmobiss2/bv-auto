const { app, BrowserWindow, shell, Menu, nativeImage, Tray, dialog, Notification, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const APP_URL = "https://bv-auto.vercel.app";
const APP_NAME = "B&V Auto";

let mainWindow;
let tray;

// ── Auto-updater config ────────────────────────────────────────────────────────
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("checking-for-update", () => {
  console.log("[updater] Checking for update…");
});

autoUpdater.on("update-available", (info) => {
  console.log("[updater] Update available:", info.version);
  if (Notification.isSupported()) {
    new Notification({
      title: "B&V Auto Update",
      body: `Version ${info.version} is downloading in the background…`,
    }).show();
  }
});

autoUpdater.on("update-not-available", () => {
  console.log("[updater] App is up to date.");
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("[updater] Update downloaded:", info.version);
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Update Ready",
    message: `B&V Auto ${info.version} is ready to install.`,
    detail: "The update will be applied when you restart the app.",
    buttons: ["Restart Now", "Later"],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on("error", (err) => {
  console.error("[updater] Error:", err.message);
});

// ── Window ─────────────────────────────────────────────────────────────────────
function createWindow() {
  const icon = nativeImage.createFromPath(path.join(__dirname, "../build/icon.png"));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    title: APP_NAME,
    icon,
    show: false,
    backgroundColor: "#f9fafb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
  });

  buildMenu();
  mainWindow.loadURL(APP_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    // Check for updates 5 seconds after launch
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  });

  // Re-check every 4 hours while running
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── Tray ───────────────────────────────────────────────────────────────────────
function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, "../build/tray.png"));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip(APP_NAME);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open B&V Auto",  click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { label: "Dashboard",      click: () => navigate("/dashboard") },
      { label: "New Job",        click: () => navigate("/jobs/new") },
      { label: "Notifications",  click: () => navigate("/notifications") },
      { type: "separator" },
      { label: "Check for Updates", click: () => autoUpdater.checkForUpdatesAndNotify() },
      { type: "separator" },
      { role: "quit" },
    ]));
    tray.on("click", () => { mainWindow?.show(); mainWindow?.focus(); });
  } catch { /* tray icon missing — skip */ }
}

function navigate(path) {
  mainWindow?.show();
  mainWindow?.webContents.loadURL(`${APP_URL}${path}`);
}

// ── Menu ───────────────────────────────────────────────────────────────────────
function buildMenu() {
  const menu = Menu.buildFromTemplate([
    ...(process.platform === "darwin" ? [{
      label: APP_NAME,
      submenu: [
        { role: "about" }, { type: "separator" },
        { role: "services" }, { type: "separator" },
        { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
        { type: "separator" }, { role: "quit" },
      ],
    }] : []),
    {
      label: "File",
      submenu: [
        { label: "New Job",     accelerator: "CmdOrCtrl+N", click: () => navigate("/jobs/new") },
        { label: "New Customer",accelerator: "CmdOrCtrl+Shift+N", click: () => navigate("/customers/new") },
        { type: "separator" },
        process.platform === "darwin" ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" }, { role: "redo" }, { type: "separator" },
        { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" },
      ],
    },
    {
      label: "Go",
      submenu: [
        { label: "Dashboard",      accelerator: "CmdOrCtrl+1", click: () => navigate("/dashboard") },
        { label: "Jobs",           accelerator: "CmdOrCtrl+2", click: () => navigate("/jobs") },
        { label: "Customers",      accelerator: "CmdOrCtrl+3", click: () => navigate("/customers") },
        { label: "Invoices",       accelerator: "CmdOrCtrl+4", click: () => navigate("/invoices") },
        { label: "Schedule",       accelerator: "CmdOrCtrl+5", click: () => navigate("/schedule") },
        { label: "Shop Board",     accelerator: "CmdOrCtrl+6", click: () => navigate("/shop-board") },
        { label: "Notifications",  accelerator: "CmdOrCtrl+Shift+N", click: () => navigate("/notifications") },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" }, { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" },
        { type: "separator" }, { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Check for Updates", click: () => autoUpdater.checkForUpdatesAndNotify() },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

// ── App lifecycle ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (e, url) => {
    if (!url.startsWith(APP_URL)) e.preventDefault();
  });
});
