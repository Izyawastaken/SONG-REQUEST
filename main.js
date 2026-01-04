const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const SpotifyService = require('./services/spotify');
const TwitchService = require('./services/twitch');

// Initialize store
const store = new Store();

const spotifyService = new SpotifyService(store);

// Initialize Services
// We don't need a full YouTubeService in main if we handle queue in renderer or via IPC.
// Actually, it's better to keep state in Renderer for the player.
// Main detects link -> Sends "queue-youtube" event to Renderer.
// Renderer manages the actual array and player.

const DownloaderService = require('./services/downloader');
const downloaderService = new DownloaderService();

const twitchService = new TwitchService(store, (channel, tags, message) => {
    // Check Settings
    const settings = store.get('settings', {});
    const enableSpotify = settings.enableSpotify !== false; // Default true
    const enableYouTube = settings.enableYouTube !== false; // Default true

    // Check for song request
    if (message.startsWith('!sr ') || message.startsWith('!songrequest ')) {
        const link = message.split(' ')[1];
        if (!link) return;

        // Spotify
        if (enableSpotify && (link.includes('spotify.com/track') || link.startsWith('spotify:track:'))) {
            mainWindow.webContents.send('log-message', `Found Spotify Link: ${link}`);
            spotifyService.addToQueue(link)
                .then(() => {
                    mainWindow.webContents.send('log-message', `Added to Spotify Queue: ${link}`);
                })
                .catch(err => {
                    mainWindow.webContents.send('log-message', `Spotify Error: ${err.message}`);
                });
        }
        // YouTube
        else if (enableYouTube && (link.includes('youtube.com/') || link.includes('youtu.be/'))) {
            mainWindow.webContents.send('log-message', `Found YouTube Link: ${link}`);
            // Send to renderer which holds the player
            mainWindow.webContents.send('queue-youtube', { link, user: tags['display-name'] });
        }
    }
});

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // Auto-connect if possible
    const settings = store.get('settings');
    if (settings) {
        if (settings.twitchChannel && settings.twitchBotToken) {
            twitchService.connect(settings.twitchChannel, settings.twitchBotToken)
                .then(() => console.log('Auto-connected to Twitch'))
                .catch(err => console.error('Failed to auto-connect Twitch', err));
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers
ipcMain.handle('get-settings', () => {
    return store.get('settings', {});
});

ipcMain.handle('save-settings', (event, settings) => {
    store.set('settings', settings);
    return true;
});

ipcMain.handle('auth-spotify', async () => {
    const settings = store.get('settings');
    if (!settings || !settings.spotifyClientId || !settings.spotifyClientSecret) {
        throw new Error('Missing Spotify Credentials');
    }

    try {
        const result = await spotifyService.authenticate(settings.spotifyClientId, settings.spotifyClientSecret);
        if (result.url) {
            shell.openExternal(result.url);
            return { status: 'waiting_for_browser' };
        }
        return { status: 'success' };
    } catch (err) {
        console.error(err);
        throw err;
    }
});

ipcMain.handle('connect-twitch', async () => {
    const settings = store.get('settings');
    if (!settings || !settings.twitchChannel || !settings.twitchBotToken) {
        throw new Error('Missing Twitch Credentials');
    }

    await twitchService.connect(settings.twitchChannel, settings.twitchBotToken);
    return true;
});

ipcMain.handle('download-track', async (event, url) => {
    return await downloaderService.download(url);
});

ipcMain.handle('get-metadata', async (event, url) => {
    return await downloaderService.getMetadata(url);
});

ipcMain.handle('save-toggles', async (event, { enableSpotify, enableYouTube }) => {
    const settings = store.get('settings', {});
    store.set('settings', { ...settings, enableSpotify, enableYouTube });
    return true;
});

ipcMain.handle('resize-window', (event, { width, height }) => {
    if (mainWindow) {
        mainWindow.setSize(width, height);
    }
});
