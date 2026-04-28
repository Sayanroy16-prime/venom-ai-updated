const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  launchApp: (appName) => ipcRenderer.invoke('system:launch-app', appName),
  getSystemInfo: () => ipcRenderer.invoke('system:get-info'),
  openUrl: (url) => ipcRenderer.invoke('system:open-url'),
});
