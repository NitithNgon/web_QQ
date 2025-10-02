// Simple Queue Backup System with Queue Name Support
class SimpleQueueBackup {
    constructor(queueName = null) {
        this.queueName = queueName || this.getCurrentQueueFromSession();
        this.backupFile = `queue-backup-${this.queueName}.json`;
        this.data = this.getDefaultData();
    }

    // Get current queue name from session or URL
    getCurrentQueueFromSession() {
        // Try to get from URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const queueFromUrl = urlParams.get('queue');
        if (queueFromUrl) {
            return queueFromUrl;
        }

        // Try to get from session storage
        const queueFromSession = sessionStorage.getItem('currentQueue');
        if (queueFromSession) {
            return queueFromSession;
        }

        // Default fallback
        return 'default';
    }

    // Initialize and load existing backup
    async init() {
        try {
            await this.loadBackup();
            console.log(`Backup system initialized for queue: ${this.queueName}`);
        } catch (error) {
            console.log('No existing backup found, starting fresh');
            await this.saveBackup();
        }
    }

    // Get default data structure
    getDefaultData() {
        return {
            queueName: this.queueName,
            currentQueue: 0,
            totalQueues: 0,
            callingQueue: 0,
            lastUpdated: new Date().toISOString(),
            queues: []
        };
    }

    // Load backup from JSON file
    async loadBackup() {
        // Fallback to localStorage with queue-specific key
        const localData = localStorage.getItem(`queueBackup_${this.queueName}`);
        if (localData) {
            this.data = JSON.parse(localData);
        }
    }

    // Save backup to both server and localStorage
    async saveBackup() {
        this.data.lastUpdated = new Date().toISOString();
        this.data.queueName = this.queueName;
        const jsonData = JSON.stringify(this.data, null, 2);

        // Always save to localStorage with queue-specific key
        localStorage.setItem(`queueBackup_${this.queueName}`, jsonData);

        // Try to save to server
        try {
            await fetch('/api/save-queue-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    queueName: this.queueName,
                    data: this.data
                })
            });
            console.log(`Backup saved to server for queue: ${this.queueName}`);
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
        this.data.totalQueues = this.data.queues.filter(q => !q.served).length;

        await this.saveBackup();
        return queue;
    }

    // End queue and save backup
    async endQueue(queueNumber) {
        const queue = this.data.queues.find(q => q.number === queueNumber && !q.served);
        if (queue) {
            queue.served = true;
            this.data.callingQueue = queueNumber;
            this.data.totalQueues = this.data.queues.filter(q => !q.served).length;
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
            queueName: this.queueName,
            currentQueue: this.data.currentQueue,
            totalQueues: this.data.totalQueues,
            callingQueue: this.data.callingQueue,
            lastUpdated: this.data.lastUpdated
        };
    }

    // Delete all data - add this method to SimpleQueueBackup class
    async deleteAllData() {
        try {
            console.log(`Attempting to delete backup from server for queue: ${this.queueName}`);
            const response = await fetch(`/api/delete-queue-backup/${this.queueName}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Server backup delete response:', result);
            } else {
                console.warn('Server backup delete failed with status:', response.status);
                const errorText = await response.text();
                console.warn('Error details:', errorText);
            }
        } catch (error) {
            console.error('Network error during server backup delete:', error);
        }
        
        // Always clear from localStorage regardless of server response
        console.log(`Clearing localStorage backup for queue: ${this.queueName}`);
        localStorage.removeItem(`queueBackup_${this.queueName}`);
        console.log(`Local backup cleared for queue: ${this.queueName}`);
        
        // Reset data to default
        this.data = this.getDefaultData();
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleQueueBackup;
} else {
    window.SimpleQueueBackup = SimpleQueueBackup;
}