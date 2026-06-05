const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  minimize: () => ipcRenderer.invoke("overlay:minimize"),
  close: () => ipcRenderer.invoke("overlay:close"),
  resetWindow: () => ipcRenderer.invoke("overlay:reset-window"),
  openLoginWindow: payload => ipcRenderer.invoke("overlay:open-login-window", payload),
  onLoginSuccess: callback => ipcRenderer.on("overlay:login-success", (_event, payload) => callback(payload)),
  getSyncConfig: () => ipcRenderer.invoke("overlay:get-sync-config"),
  saveSyncConfig: config => ipcRenderer.invoke("overlay:save-sync-config", config)
});
