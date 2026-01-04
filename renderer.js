// Basic renderer logic (placeholder)
const logDiv = document.getElementById('log');

function log(message) {
    const el = document.createElement('div');
    el.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
    logDiv.appendChild(el);
    logDiv.scrollTop = logDiv.scrollHeight;
}

// Ensure API is exposed
if (window.api) {
    // Initialize Icons
    if (window.lucide) window.lucide.createIcons();

    window.api.log((msg) => log(msg));

    // --- Configuration Toggle Logic ---
    const configSection = document.getElementById('config-section');
    const settingsBtn = document.getElementById('settings-toggle');
    let isConfigOpen = false;

    if (settingsBtn && configSection) {
        settingsBtn.addEventListener('click', () => {
            isConfigOpen = !isConfigOpen;
            if (isConfigOpen) {
                configSection.classList.remove('collapsed');
                settingsBtn.style.color = 'var(--text-primary)';
            } else {
                configSection.classList.add('collapsed');
                settingsBtn.style.color = 'var(--text-secondary)';
            }
        });
    }

    // Load saved settings on startup
    // Settings loaded in Toggle Section below

    document.getElementById('authSpotify').addEventListener('click', async () => {
        const clientId = document.getElementById('spotifyClientId').value;
        const clientSecret = document.getElementById('spotifyClientSecret').value;

        if (!clientId || !clientSecret) {
            log('Error: Please enter Spotify Client ID and Secret');
            return;
        }

        // Save settings first
        const currentSettings = await window.api.getSettings();
        await window.api.saveSettings({
            ...currentSettings,
            spotifyClientId: clientId,
            spotifyClientSecret: clientSecret
        });

        log('Saving Spotify credentials... Initiating Auth...');
        try {
            const result = await window.api.authSpotify();
            if (result.status === 'waiting_for_browser') {
                log('Opened browser for Spotify login. Waiting for callback...');
            } else {
                log('Spotify Authentication successful!');
                document.getElementById('spotify-status').classList.add('connected');
            }
        } catch (err) {
            log('Error authenticating Spotify: ' + err.message);
        }
    });

    // Toggle Twitch Auth Modes
    document.getElementById('toggle-manual-twitch').addEventListener('click', () => {
        document.getElementById('twitch-auto-auth').classList.add('hidden');
        document.getElementById('twitch-manual-auth').classList.remove('hidden');
    });

    document.getElementById('toggle-auto-twitch').addEventListener('click', () => {
        document.getElementById('twitch-manual-auth').classList.add('hidden');
        document.getElementById('twitch-auto-auth').classList.remove('hidden');
    });

    // Twitch Auto Auth
    document.getElementById('authTwitchBtn').addEventListener('click', async () => {
        const channel = document.getElementById('twitchChannel').value;
        if (!channel) {
            log('Error: Please enter a Channel Name first');
            return;
        }

        // Logic adapted from Overlook project
        const APP_NAME = 'SongRequestBot'; // Can use same as Overlook or new one
        const SCOPES = 'chat:read+chat:edit';

        try {
            log('Initiating Twitch Auth Flow...');

            // 1. Create Flow
            const createUrl = `https://twitchtokengenerator.com/api/create/${btoa(APP_NAME)}/${SCOPES}`;
            const createResponse = await fetch(createUrl);
            const createData = await createResponse.json();

            if (!createData.success) {
                throw new Error('Failed to create auth flow');
            }

            const authFlowId = createData.id;
            const authUrl = createData.message;

            log(`Opening Auth URL. Please approve in your browser.`);

            // Open external browser
            // Open external browser
            // window.open here is intercepted by main.js to use shell.openExternal.
            window.open(authUrl);

            // 2. Poll for token
            log('Waiting for approval...');
            const pollInterval = setInterval(async () => {
                try {
                    const statusUrl = `https://twitchtokengenerator.com/api/status/${authFlowId}`;
                    const statusResponse = await fetch(statusUrl);
                    const statusData = await statusResponse.json();

                    if (statusData.success) {
                        clearInterval(pollInterval);
                        log('Twitch Auth Successful! Token received.');

                        const token = statusData.token;
                        // const refreshToken = statusData.refresh; // If we wanted to persist longer

                        // Save settings
                        const currentSettings = await window.api.getSettings();
                        await window.api.saveSettings({
                            ...currentSettings,
                            twitchChannel: channel,
                            twitchBotToken: `oauth:${token}`
                        });

                        // Connect
                        log('Connecting to Twitch Chat...');
                        await window.api.connectTwitch();
                        document.getElementById('twitch-status').classList.add('connected');
                        log('Connected! Ready for !sr commands.');

                    } else if (statusData.message && statusData.message.includes('expired')) {
                        clearInterval(pollInterval);
                        log('Auth flow expired. Please try again.');
                    }
                } catch (e) {
                    // Ignore poll errors
                }
            }, 2000);

            // Timeout after 5 mins
            setTimeout(() => clearInterval(pollInterval), 300000);

        } catch (err) {
            log('Error initiating Twitch Auth: ' + err.message);
        }
    });

    document.getElementById('connectTwitch').addEventListener('click', async () => {
        const channel = document.getElementById('twitchChannel').value;
        const token = document.getElementById('twitchBotToken').value;

        if (!channel || !token) {
            log('Error: Please enter Twitch Channel and Token');
            return;
        }

        // Save settings
        const currentSettings = await window.api.getSettings();
        await window.api.saveSettings({
            ...currentSettings,
            twitchChannel: channel,
            twitchBotToken: token
        });

        log('Saved Twitch settings. Connecting...');
        try {
            await window.api.connectTwitch();
            log('Twitch Connected! Listening for !sr commands...');
            document.getElementById('twitch-status').classList.add('connected');
        } catch (err) {
            log('Error connecting to Twitch: ' + err.message);
        }
    });
    // --- Settings Toggles ---
    const enableSpotify = document.getElementById('enable-spotify');
    const enableYouTube = document.getElementById('enable-youtube');
    const spotifyConfigCard = document.getElementById('spotify-config-card');
    const youtubeQueueCard = document.getElementById('youtube-queue-card');

    function updateVisibility() {
        if (enableSpotify.checked) {
            spotifyConfigCard.classList.remove('hidden');
        } else {
            spotifyConfigCard.classList.add('hidden');
        }

        if (enableYouTube.checked) {
            youtubeQueueCard.classList.remove('hidden');
        } else {
            youtubeQueueCard.classList.add('hidden');
        }
    }

    // Load Toggle State & Credentials
    window.api.getSettings().then(settings => {
        // Toggles
        if (settings.enableSpotify !== undefined) enableSpotify.checked = settings.enableSpotify;
        if (settings.enableYouTube !== undefined) enableYouTube.checked = settings.enableYouTube;

        // Credentials
        if (settings.spotifyClientId) document.getElementById('spotifyClientId').value = settings.spotifyClientId;
        if (settings.spotifyClientSecret) document.getElementById('spotifyClientSecret').value = settings.spotifyClientSecret;
        if (settings.twitchChannel) document.getElementById('twitchChannel').value = settings.twitchChannel;
        // Don't show full token for security if possible, or maybe masked? For now standard value.
        if (settings.twitchBotToken) document.getElementById('twitchBotToken').value = settings.twitchBotToken;

        // Auto-update visibility
        updateVisibility();

        // Check if previously connected (Optimistic UI)
        if (settings.twitchChannel && settings.twitchBotToken) {
            document.getElementById('twitch-status').classList.add('connected');
            log('Twitch credentials found. Auto-connecting in background...');
        }
    });

    function saveToggles() {
        window.api.saveToggles({
            enableSpotify: enableSpotify.checked,
            enableYouTube: enableYouTube.checked
        });
        updateVisibility();
    }

    enableSpotify.addEventListener('change', saveToggles);
    enableYouTube.addEventListener('change', saveToggles);

    // --- YouTube Integration (yt-dlp) ---
    const audioPlayer = document.getElementById('audio-player');
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');
    const progressBar = document.getElementById('progress-bar');
    const artElement = document.querySelector('.album-art');

    let ytQueue = [];
    let isDownloading = false;
    let currentPlayingItem = null; // Track what's playing for real

    // Progress Bar Logic
    if (progressBar) {
        audioPlayer.addEventListener('timeupdate', () => {
            if (audioPlayer.duration) {
                const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                progressBar.value = percent;
            }
        });

        progressBar.addEventListener('input', () => {
            if (audioPlayer.duration) {
                const time = (progressBar.value / 100) * audioPlayer.duration;
                audioPlayer.currentTime = time;
            }
        });
    }

    // Handle audio ended
    audioPlayer.addEventListener('ended', () => {
        playNext();
        updatePlayButton();
    });

    audioPlayer.addEventListener('pause', updatePlayButton);
    audioPlayer.addEventListener('play', updatePlayButton);

    const playPauseBtn = document.getElementById('play-pause-btn');
    playPauseBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
            // If no source, try to play current or next
            if (!audioPlayer.src && ytQueue.length > 0) {
                playNext();
            } else if (audioPlayer.src) {
                audioPlayer.play();
            }
        } else {
            audioPlayer.pause();
        }
    });

    function updatePlayButton() {
        const isPaused = audioPlayer.paused;
        const iconName = isPaused ? 'play' : 'pause';
        playPauseBtn.innerHTML = `<i data-lucide="${iconName}" width="24"></i>`;
        if (window.lucide) window.lucide.createIcons();
    }

    // Handle error
    audioPlayer.addEventListener('error', (e) => {
        log('Audio Playback Error: ' + e.message);
        playNext();
    });

    function extractVideoId(url) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length == 11) ? match[7] : false;
    }

    function updateNowPlayingUI(item) {
        if (trackTitle) trackTitle.innerText = item.title || item.url || "Unknown Title";
        if (trackArtist) trackArtist.innerText = `Requested by ${item.user}`;

        // Update rotating background for stream view
        const streamBg = document.getElementById('stream-bg');
        if (streamBg) {
            if (item.thumbnail) {
                streamBg.style.backgroundImage = `url("${item.thumbnail}")`;
                streamBg.classList.add('visible');
            } else {
                streamBg.classList.remove('visible');
            }
        }

        if (artElement) {
            if (item.thumbnail) {
                artElement.innerHTML = `<img src="${item.thumbnail}" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-m);">`;
            } else {
                artElement.innerHTML = `<i data-lucide="music" width="40" height="40" color="#555"></i>`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    }

    // handle queue-youtube event
    window.api.onQueueYouTube(async ({ link, user }) => {
        const videoId = extractVideoId(link);
        if (videoId) {
            const item = {
                id: videoId,
                user,
                url: link,
                title: `Video ${videoId}`,
                thumbnail: null
            };

            ytQueue.push(item);
            updateQueueUI();
            log(`Added to YouTube Queue: ${link} (by ${user})`);

            // Fetch Metadata
            window.api.getMetadata(link).then(meta => {
                // Log what we got to help usage debugging
                // log('Metadata received for ' + link + ': ' + JSON.stringify(meta));

                if (meta) {
                    item.title = meta.title || item.title;
                    item.thumbnail = meta.thumbnail;
                    updateQueueUI();

                    // If this item is currently playing, update the NOW PLAYING UI
                    if (currentPlayingItem && currentPlayingItem.id === item.id) {
                        // Update reference
                        currentPlayingItem = item;
                        updateNowPlayingUI(item);
                    }
                }
            });

            // If nothing playing, play immediately
            const shouldPlay = audioPlayer.paused && ytQueue.length === 1 && !isDownloading;

            if (shouldPlay) {
                playNext();
            }
        } else {
            log('Invalid YouTube Link received');
        }
    });

    async function playNext() {
        if (ytQueue.length > 0) {
            const next = ytQueue[0]; // Peek
            currentPlayingItem = next; // Set as current

            if (trackTitle) trackTitle.innerText = "Downloading...";
            if (trackArtist) trackArtist.innerText = next.title || next.url;
            isDownloading = true;

            try {
                log(`Downloading audio for ${next.url}...`);
                const filePath = await window.api.downloadTrack(next.url);

                isDownloading = false;
                ytQueue.shift(); // Remove from queue
                updateQueueUI();

                log(`Playing: ${next.title || next.url}`);

                // Update UI using helper
                updateNowPlayingUI(next);

                // Set source. 
                const safePath = filePath.replace(/\\/g, '/');
                audioPlayer.src = `file:///${safePath}`;

                audioPlayer.play().catch(e => {
                    log(`Play Error: ${e.message}`);
                    console.error("Play Error", e);
                });

                updatePlayButton();

                // --- PREFETCH NEXT ITEM ---
                if (ytQueue.length > 0) {
                    const nextItem = ytQueue[0];
                    log(`Prefetching next song: ${nextItem.title || nextItem.url}`);
                    window.api.downloadTrack(nextItem.url).catch(e => log(`Prefetch failed: ${e.message}`));
                }

            } catch (err) {
                isDownloading = false;
                log(`Download failed: ${err.message}`);
                ytQueue.shift();
                updateQueueUI();
                playNext(); // Try next
            }
        } else {
            if (trackTitle) trackTitle.innerText = "Not Playing";
            if (trackArtist) trackArtist.innerText = "Queue is empty";
            currentPlayingItem = null;
            
            // Clear the rotating background
            const streamBg = document.getElementById('stream-bg');
            if (streamBg) {
                streamBg.classList.remove('visible');
            }
            
            log('YouTube Queue finished.');
        }
    }

    function updateQueueUI() {
        const div = document.getElementById('yt-queue');
        if (ytQueue.length === 0) {
            div.innerHTML = '<div style="text-align: center; color: #666; padding: 10px;">Queue is empty</div>';
            return;
        }

        div.innerHTML = ytQueue.map((item, index) => `
            <div style="display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #333; font-size: 14px;">
                <span style="color: #666; margin-right: 12px; min-width: 20px;">${index + 1}.</span>
                ${item.thumbnail ? `<img src="${item.thumbnail}" style="width: 40px; height: 40px; object-fit: cover; margin-right: 12px; border-radius: 4px;">` : ''}
                <div style="flex: 1; overflow: hidden;">
                    <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
                        <a href="${item.url}" target="_blank" style="color: var(--text-primary); text-decoration: none;">${item.title || item.url}</a>
                    </div>
                    <div style="color: #666; font-size: 12px;">Requested by ${item.user}</div>
                </div>
            </div>
        `).join('');
    }

    // --- Stream View / Mini Player Logic ---
    const streamViewBtn = document.getElementById('stream-view-btn');
    const exitStreamViewBtn = document.getElementById('exit-stream-view');

    if (streamViewBtn) {
        streamViewBtn.addEventListener('click', () => {
            document.body.classList.add('stream-mode');
            window.api.resizeWindow({ width: 400, height: 600 });
        });
    }

    if (exitStreamViewBtn) {
        exitStreamViewBtn.addEventListener('click', () => {
            document.body.classList.remove('stream-mode');
            window.api.resizeWindow({ width: 1000, height: 800 });
        });
    }

} else {
    console.error('API not found in window');
}
