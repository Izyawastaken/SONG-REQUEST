const tmi = require('tmi.js');

class TwitchService {
    constructor(store, onMessageCallback) {
        this.store = store;
        this.client = null;
        this.onMessageCallback = onMessageCallback;
        this.isConnected = false;
    }

    async connect(channel, token) {
        // If already connected, disconnect first
        if (this.client) {
            await this.client.disconnect().catch(() => { });
        }

        // Token usually needs 'oauth:' prefix
        if (!token.startsWith('oauth:')) {
            token = `oauth:${token}`;
        }

        this.client = new tmi.Client({
            identity: {
                username: 'justinfan123', // Anonymous if no token, but we need token to verify it works for user context usually? 
                // Actually for reading chat anonymous is fine, but users usually want their bot to reply.
                // For this simple task, let's use the provided token.
                username: channel, // Assume user uses their own account as bot, or we can deal with separate bot name later.
                password: token
            },
            channels: [channel]
        });

        this.client.on('message', (channel, tags, message, self) => {
            if (self) return;
            if (this.onMessageCallback) {
                this.onMessageCallback(channel, tags, message);
            }
        });

        await this.client.connect();
        this.isConnected = true;
        return true;
    }

    disconnect() {
        if (this.client) {
            this.client.disconnect();
            this.isConnected = false;
        }
    }
}

module.exports = TwitchService;
