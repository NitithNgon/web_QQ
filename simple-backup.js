// Simple Queue Backup System
class SimpleQueueBackup {
    constructor() {
        this.backupFile = 'queue-backup.json';
        this.data = this.getDefaultData();
        this.init();
    }

    // Initialize and load existing backup
    async init() {
        try {
            await this.loadBackup();
            console.log('Backup system initialized');
        } catch (error) {
            console.log('No existing backup found, starting fresh');
            await this.saveBackup();
        }
    }

    // Get default data structure
    getDefaultData() {
        return {
            currentQueue: 0,
            totalQueues: 0,
            callingQueue: 0,
            lastUpdated: new Date().toISOString(),
            queues: []
        };
    }

    // Load backup from JSON file
    async loadBackup() {
        try {
            // Try to fetch from server first
            const response = await fetch(this.backupFile);
            if (response.ok) {
                this.data = await response.json();
                return;
            }
        } catch (error) {
            console.log('Server not available, checking localStorage');
        }

        // Fallback to localStorage
        const localData = localStorage.getItem('queueBackup');
        if (localData) {
            this.data = JSON.parse(localData);
        }
    }

    // Save backup to both server and localStorage
    async saveBackup() {
        this.data.lastUpdated = new Date().toISOString();
        const jsonData = JSON.stringify(this.data, null, 2);

        // Always save to localStorage
        localStorage.setItem('queueBackup', jsonData);

        // Try to save to server
        try {
            await fetch('/api/save-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonData
            });
            console.log('Backup saved to server');
        } catch (error) {
            console.log('Server save failed, using localStorage only');
        }
    }

    // Add new queue and save backup
    async addQueue(queueNumber) {
        const queue = {
            id: Date.now(),
            number: queueNumber,
            timestamp: new Date().toISOString(),
            served: false
        };

        this.data.queues.push(queue);
        this.data.currentQueue = queueNumber;
        this.data.totalQueues++;

        await this.saveBackup();
        return queue;
    }

    // end queue and save backup
    async endQueue(queueNumber) {
        const queue = this.data.queues.find(q => q.number === queueNumber && !q.served);
        if (queue) {
            queue.served = true;
            this.data.callingQueue = queueNumber;
            this.data.totalQueues--;
        }

        await this.saveBackup();
        return queue;
    }

    // Reset all queues and save backup
    async resetQueues() {
        this.data = this.getDefaultData();
        await this.saveBackup();
    }

    // Get current status
    getCurrentStatus() {
        return {
            currentQueue: this.data.currentQueue,
            totalQueues: this.data.totalQueues,
            lastUpdated: this.data.lastUpdated,
            callingQueue: this.data.callingQueue,
        };
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleQueueBackup;
} else {
    window.SimpleQueueBackup = SimpleQueueBackup;
}