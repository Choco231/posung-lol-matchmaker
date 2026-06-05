const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  minimize: () => ipcRenderer.invoke("overlay:minimize"),
  close: () => ipcRenderer.invoke("overlay:close"),
  resetWindow: () => ipcRenderer.invoke("overlay:reset-window"),
  setLoginMode: enabled => ipcRenderer.invoke("overlay:set-login-mode", enabled),
  getSyncConfig: () => ipcRenderer.invoke("overlay:get-sync-config"),
  saveSyncConfig: config => ipcRenderer.invoke("overlay:save-sync-config", config)
});
