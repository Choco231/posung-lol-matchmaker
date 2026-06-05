const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlayAPI", {
  minimize: () => ipcRenderer.invoke("overlay:minimize"),
  close: () => ipcRenderer.invoke("overlay:close"),
  resetWindow: () => ipcRenderer.invoke("overlay:reset-window"),
  getSyncConfig: () => ipcRenderer.invoke("overlay:get-sync-config")
});
