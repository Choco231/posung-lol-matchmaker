const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");

let mainWindow;
const logPath = path.join(__dirname, "overlay-debug.log");
const userDataPath = path.join(__dirname, ".overlay-user-data");
const syncConfigPath = path.join(__dirname, "overlay-config.json");
const DEFAULT_WIDTH = 140;
const DEFAULT_HEIGHT = 272;

fs.mkdirSync(userDataPath, { recursive: true });
app.setPath("userData", userDataPath);
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("disable-features", "NetworkServiceSandbox");
app.commandLine.appendSwitch("no-sandbox");

function log(message) {
  fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
}

function createWindow() {
  log("createWindow");
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    x: Math.max(0, width - DEFAULT_WIDTH - 20),
    y: 40,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.on("closed", () => {
    log("window closed");
    mainWindow = null;
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log(`render process gone: ${JSON.stringify(details)}`);
  });
  mainWindow.loadFile("index.html").then(() => log("index loaded")).catch(error => log(`load failed: ${error.stack}`));
}

app.whenReady().then(() => {
  log("app ready");
  createWindow();

  globalShortcut.register("Control+Shift+R", () => {
    if (!mainWindow) return;
    mainWindow.setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
    mainWindow.center();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  log("will quit");
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  log("window all closed");
  if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", error => {
  log(`uncaught exception: ${error.stack}`);
});

process.on("unhandledRejection", error => {
  log(`unhandled rejection: ${error?.stack || error}`);
});

ipcMain.handle("overlay:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("overlay:close", () => {
  mainWindow?.close();
});

ipcMain.handle("overlay:reset-window", () => {
  if (!mainWindow) return;
  mainWindow.setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
  mainWindow.center();
});

ipcMain.handle("overlay:get-sync-config", () => {
  try {
    if (!fs.existsSync(syncConfigPath)) {
      return { enabled: false, serverUrl: "", token: "" };
    }
    const config = JSON.parse(fs.readFileSync(syncConfigPath, "utf8"));
    return {
      enabled: Boolean(config.enabled),
      serverUrl: String(config.serverUrl || "").replace(/\/+$/, ""),
      token: String(config.token || "")
    };
  } catch (error) {
    log(`sync config read failed: ${error.stack || error}`);
    return { enabled: false, serverUrl: "", token: "" };
  }
});
