const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("loginAPI", {
  success: payload => ipcRenderer.invoke("login:success", payload),
  cancel: () => ipcRenderer.invoke("login:cancel"),
  onMessage: callback => ipcRenderer.on("login:set-message", (_event, message) => callback(message))
});
