const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require("electron");

let mainWindow;
let loginWindow;
const logPath = path.join(__dirname, "overlay-debug.log");
const userDataPath = path.join(__dirname, ".overlay-user-data");
const syncConfigPath = path.join(__dirname, "overlay-config.json");
const DEFAULT_WIDTH = 140;
const DEFAULT_HEIGHT = 272;
const LOGIN_WIDTH = 360;
const LOGIN_HEIGHT = 360;
const DEFAULT_SERVER_URL = "https://posung-lol-match.win";

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

function createLoginWindow(serverUrl = DEFAULT_SERVER_URL, message = "") {
  if (loginWindow) {
    loginWindow.focus();
    loginWindow.webContents.send("login:set-message", message);
    return;
  }

  loginWindow = new BrowserWindow({
    width: LOGIN_WIDTH,
    height: LOGIN_HEIGHT,
    parent: mainWindow || undefined,
    modal: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    backgroundColor: "#101722",
    webPreferences: {
      preload: path.join(__dirname, "login-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  loginWindow.on("closed", () => {
    loginWindow = null;
  });

  const query = new URLSearchParams({ serverUrl, message }).toString();
  loginWindow.loadFile("login.html", { query }).catch(error => log(`login load failed: ${error.stack}`));
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

ipcMain.handle("overlay:open-login-window", (_event, payload) => {
  createLoginWindow(payload?.serverUrl || DEFAULT_SERVER_URL, payload?.message || "");
});

ipcMain.handle("overlay:get-sync-config", () => {
  try {
    if (!fs.existsSync(syncConfigPath)) {
      return { enabled: true, serverUrl: DEFAULT_SERVER_URL, token: "" };
    }
    const config = JSON.parse(fs.readFileSync(syncConfigPath, "utf8"));
    return {
      enabled: Boolean(config.enabled),
      serverUrl: String(config.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, ""),
      token: String(config.token || "")
    };
  } catch (error) {
    log(`sync config read failed: ${error.stack || error}`);
    return { enabled: true, serverUrl: DEFAULT_SERVER_URL, token: "" };
  }
});

ipcMain.handle("overlay:save-sync-config", (_event, config) => {
  try {
    const nextConfig = {
      enabled: Boolean(config?.enabled),
      serverUrl: String(config?.serverUrl || "").replace(/\/+$/, ""),
      token: String(config?.token || "")
    };
    fs.writeFileSync(syncConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
    return { ok: true, config: nextConfig };
  } catch (error) {
    log(`sync config write failed: ${error.stack || error}`);
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.handle("login:success", (_event, payload) => {
  const serverUrl = String(payload?.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, "");
  const token = String(payload?.token || "");
  try {
    fs.writeFileSync(syncConfigPath, `${JSON.stringify({ enabled: true, serverUrl, token: "" }, null, 2)}\n`, "utf8");
  } catch (error) {
    log(`sync server url save failed: ${error.stack || error}`);
  }
  mainWindow?.webContents.send("overlay:login-success", { serverUrl, token });
  loginWindow?.close();
});

ipcMain.handle("login:cancel", () => {
  loginWindow?.close();
  mainWindow?.close();
});
