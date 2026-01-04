const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');

class SpotifyService {
    constructor(store) {
        this.store = store;
        this.api = null;
        this.server = null;
        this.isAuthenticated = false;

        // Try to load existing tokens
        const tokens = this.store.get('spotifyTokens');
        const creds = this.store.get('settings');

        if (creds && creds.spotifyClientId && creds.spotifyClientSecret) {
            this.initApi(creds.spotifyClientId, creds.spotifyClientSecret);
            if (tokens) {
                this.api.setAccessToken(tokens.accessToken);
                this.api.setRefreshToken(tokens.refreshToken);
                this.isAuthenticated = true;
                this.refreshAccessToken(); // Refresh on load
            }
        }
    }

    initApi(clientId, clientSecret) {
        this.api = new SpotifyWebApi({
            clientId: clientId,
            clientSecret: clientSecret,
            redirectUri: 'http://localhost:8888/callback'
        });
    }

    async authenticate(clientId, clientSecret) {
        this.initApi(clientId, clientSecret);

        // Start local server to listen for callback
        return new Promise((resolve, reject) => {
            const app = express();
            this.server = app.listen(8888, () => {
                console.log('Local server listening on 8888');
            });

            app.get('/callback', async (req, res) => {
                const code = req.query.code;
                if (code) {
                    try {
                        const data = await this.api.authorizationCodeGrant(code);

                        this.api.setAccessToken(data.body['access_token']);
                        this.api.setRefreshToken(data.body['refresh_token']);

                        this.store.set('spotifyTokens', {
                            accessToken: data.body['access_token'],
                            refreshToken: data.body['refresh_token']
                        });

                        this.isAuthenticated = true;
                        res.send('Spotify Authentication Successful! You can close this window.');

                        // Close server
                        if (this.server) {
                            this.server.close();
                            this.server = null;
                        }

                        resolve(true);
                    } catch (err) {
                        res.send('Error during authentication: ' + err);
                        reject(err);
                    }
                } else {
                    res.send('No code provided');
                    reject(new Error('No code provided'));
                }
            });

            const scopes = ['user-modify-playback-state']; // Scope valid for adding to queue
            const authorizeURL = this.api.createAuthorizeURL(scopes);

            // Return URL to be opened by Main Process
            resolve({ url: authorizeURL });
        });
    }

    async refreshAccessToken() {
        if (!this.api) return;
        try {
            const data = await this.api.refreshAccessToken();
            this.api.setAccessToken(data.body['access_token']);

            // Update store
            const current = this.store.get('spotifyTokens');
            this.store.set('spotifyTokens', {
                ...current,
                accessToken: data.body['access_token']
            });
            console.log('Spotify access token refreshed');
        } catch (err) {
            console.error('Could not refresh access token', err);
            this.isAuthenticated = false;
        }
    }

    async addToQueue(trackUrl) {
        if (!this.isAuthenticated) throw new Error('Not authenticated with Spotify');

        // Extract Track ID from URL
        // Expected format: https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=...
        // or just spotify:track:4uLU6hMCjMI75M1A2tKUQC
        let uri = trackUrl;
        if (trackUrl.includes('https://open.spotify.com/track/')) {
            const parts = trackUrl.split('/track/')[1].split('?')[0];
            uri = `spotify:track:${parts}`;
        }

        return this.api.addToQueue(uri);
    }
}

module.exports = SpotifyService;
