const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    getAppVersion: () => ipcRenderer.invoke("get-app-version"),

    downloadUpdate: (downloadUrl) =>
        ipcRenderer.invoke("download-update", downloadUrl),

    installUpdate: (installerPath) =>
        ipcRenderer.invoke("install-update", installerPath),

    onDownloadProgress: (callback) =>
        ipcRenderer.on("download-progress", (event, percent) => {
            callback(percent);
        }),

    getLicenseKey: () => ipcRenderer.invoke("get-license-key"),

    saveLicenseKey: (key) => ipcRenderer.invoke("save-license-key", key)
});