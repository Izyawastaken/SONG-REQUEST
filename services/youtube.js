class YouTubeService {
    constructor() {
        this.queue = [];
        this.currentVideo = null;
    }

    extractVideoId(url) {
        // Supported formats:
        // youtube.com/watch?v=VIDEO_ID
        // youtu.be/VIDEO_ID
        // youtube.com/shorts/VIDEO_ID

        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length == 11) ? match[7] : false;
    }

    addToQueue(url, user) {
        const videoId = this.extractVideoId(url);
        if (!videoId) return null;

        const item = {
            id: videoId,
            url: url,
            user: user,
            addedAt: new Date()
        };

        this.queue.push(item);
        return item;
    }

    getNext() {
        if (this.queue.length === 0) return null;
        this.currentVideo = this.queue.shift();
        return this.currentVideo;
    }

    // We might need to fetch metadata (title) via API later, 
    // but for now let's just use ID to play.
}

module.exports = YouTubeService;
