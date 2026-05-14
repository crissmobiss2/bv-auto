const { app, BrowserWindow, shell, Menu, nativeImage, Tray, ipcMain } = require("electron");
const path = require("path");

const APP_URL = "https://bv-auto.vercel.app";
const APP_NAME = "B&V Auto";

let mainWindow;
let tray;

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

  // Native application menu
  const menu = Menu.buildFromTemplate([
    ...(process.platform === "darwin"
      ? [{ label: APP_NAME, submenu: [
          { role: "about" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ]}]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Job",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.loadURL(`${APP_URL}/jobs/new`),
        },
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
      label: "View",
      submenu: [
        { label: "Dashboard",      accelerator: "CmdOrCtrl+1", click: () => mainWindow?.webContents.loadURL(`${APP_URL}/dashboard`) },
        { label: "Jobs",           accelerator: "CmdOrCtrl+2", click: () => mainWindow?.webContents.loadURL(`${APP_URL}/jobs`) },
        { label: "Customers",      accelerator: "CmdOrCtrl+3", click: () => mainWindow?.webContents.loadURL(`${APP_URL}/customers`) },
        { label: "Invoices",       accelerator: "CmdOrCtrl+4", click: () => mainWindow?.webContents.loadURL(`${APP_URL}/invoices`) },
        { type: "separator" },
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(process.platform === "darwin" ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }]),
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  mainWindow.loadURL(APP_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  try {
    const trayIcon = nativeImage.createFromPath(path.join(__dirname, "../build/tray.png"));
    tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
    const contextMenu = Menu.buildFromTemplate([
      { label: "Open B&V Auto", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { label: "Dashboard",     click: () => { mainWindow?.show(); mainWindow?.webContents.loadURL(`${APP_URL}/dashboard`); } },
      { label: "New Job",       click: () => { mainWindow?.show(); mainWindow?.webContents.loadURL(`${APP_URL}/jobs/new`); } },
      { type: "separator" },
      { role: "quit" },
    ]);
    tray.setToolTip(APP_NAME);
    tray.setContextMenu(contextMenu);
    tray.on("click", () => { mainWindow?.show(); mainWindow?.focus(); });
  } catch {
    // Tray icon file not found — skip tray
  }
}

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

// Security: prevent new window creation
app.on("web-contents-created", (_, contents) => {
  contents.on("will-navigate", (e, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith("https://bv-auto.vercel.app")) {
      e.preventDefault();
    }
  });
});
