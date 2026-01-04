const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    authSpotify: () => ipcRenderer.invoke('auth-spotify'),
    connectTwitch: () => ipcRenderer.invoke('connect-twitch'),
    saveToggles: (toggles) => ipcRenderer.invoke('save-toggles', toggles),
    downloadTrack: (url) => ipcRenderer.invoke('download-track', url),
    getMetadata: (url) => ipcRenderer.invoke('get-metadata', url),
    log: (callback) => ipcRenderer.on('log-message', (_event, value) => callback(value)),
    onQueueYouTube: (callback) => ipcRenderer.on('queue-youtube', (_event, value) => callback(value)),
    resizeWindow: (dims) => ipcRenderer.invoke('resize-window', dims),
});
