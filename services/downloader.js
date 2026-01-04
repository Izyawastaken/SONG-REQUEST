const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const exec = require('yt-dlp-exec');

class DownloaderService {
    constructor() {
        // Use app.getPath('userData') or 'temp'
        // 'temp' + 'song-request-cache'
        this.cacheDir = path.join(app.getPath('temp'), 'song-request-cache');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }

        // Run cleanup every 15 minutes
        setInterval(() => this.cleanup(), 15 * 60 * 1000);
        this.cleanup(); // Run on start
    }

    async getMetadata(url) {
        try {
            console.log(`Fetching metadata for ${url}...`);
            const output = await exec(url, {
                dumpSingleJson: true,
                noPlaylist: true,
                flatPlaylist: true // Faster if we just need info
            });
            return output;
        } catch (err) {
            console.error('Metadata fetch failed:', err);
            return null;
        }
    }

    async download(url) {
        // Generate a filename based on video ID to prevent duplicates
        // We can extract ID or just hash the URL.
        const videoIdMatches = url.match(/v=([^&]+)/);
        const videoId = videoIdMatches ? videoIdMatches[1] : Date.now().toString();
        const outputPath = path.join(this.cacheDir, `${videoId}.mp3`);

        if (fs.existsSync(outputPath)) {
            console.log(`File already exists: ${outputPath}`);
            return outputPath;
        }

        console.log(`Downloading ${url} to ${outputPath}...`);

        try {
            await exec(url, {
                extractAudio: true,
                audioFormat: 'mp3',
                output: path.join(this.cacheDir, '%(id)s.%(ext)s'),
                noPlaylist: true,
                preferFreeFormats: true,
                // Optimizations
                format: 'bestaudio',
                externalDownloader: 'ffmpeg',
                externalDownloaderArgs: 'ffmpeg:-threads 8',
                concurrentFragments: 10,
                fragmentRetries: 3,
                httpChunkSize: '10M'
            });

            const files = fs.readdirSync(this.cacheDir);
            const foundFile = files.find(f => f.startsWith(videoId));
            if (foundFile) {
                return path.join(this.cacheDir, foundFile);
            }
            throw new Error('Download finished but file not found');
        } catch (err) {
            console.error('Download failed:', err);
            throw err;
        }
    }

    cleanup() {
        console.log('Running cleanup...');
        const now = Date.now();
        const maxAge = 15 * 60 * 1000; // 15 mins

        fs.readdir(this.cacheDir, (err, files) => {
            if (err) return console.error('Cleanup error:', err);

            files.forEach(file => {
                const filePath = path.join(this.cacheDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    if (now - stats.mtimeMs > maxAge) {
                        fs.unlink(filePath, err => {
                            if (err) console.error(`Failed to delete ${file}`, err);
                            else console.log(`Deleted old file: ${file}`);
                        });
                    }
                });
            });
        });
    }
}

module.exports = DownloaderService;
