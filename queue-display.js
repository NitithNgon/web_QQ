// Queue display system for patients
class QueueDisplay {
    constructor() {
        this.currentQueue = 0;
        this.totalQueues = 0;
        this.servedQueues = 0;
        this.backup = null;
        this.initializeBackup();
    }

    // Initialize backup system and load data
    async initializeBackup() {
        try {
            this.backup = new SimpleQueueBackup();
            await this.backup.init();
            this.loadQueueData();
            this.initializeEventListeners();
            this.updateDisplay();
            this.startAutoRefresh();
            this.checkForQRData();
        } catch (error) {
            console.error('Backup initialization failed:', error);
            this.initializeEventListeners();
            this.updateDisplay();
            this.startAutoRefresh();
            this.checkForQRData();
        }
    }

    // Load queue data from backup
    loadQueueData() {
        if (this.backup) {
            const status = this.backup.getCurrentStatus();
            this.currentQueue = status.currentQueue;
            this.totalQueues = status.totalQueues;
            this.servedQueues = Math.max(0, this.currentQueue - 1);
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Listen for storage changes (when distributor updates data)
        window.addEventListener('storage', (e) => {
            if (e.key === 'queueData') {
                this.loadQueueData();
                this.updateDisplay();
            }
        });
    }

    // Check if page was loaded via QR code
    checkForQRData() {
        const urlParams = new URLSearchParams(window.location.search);
        const qrData = urlParams.get('qr');
        
        if (qrData) {
            try {
                const data = JSON.parse(decodeURIComponent(qrData));
                this.highlightUserQueue(data.queueNumber);
            } catch (error) {
                console.error('Invalid QR data:', error);
            }
        }
    }

    // Highlight specific queue number for user
    highlightUserQueue(userQueueNumber) {
        const status = document.getElementById('queueStatus');
        if (userQueueNumber <= this.currentQueue) {
            status.innerHTML = `
                <div style="color: #4CAF50; font-weight: bold;">
                    ✅ Your queue number ${userQueueNumber} has been served!
                </div>
            `;
        } else {
            const remaining = userQueueNumber - this.currentQueue;
            status.innerHTML = `
                <div style="color: #2196F3; font-weight: bold;">
                    🎫 Your queue number: ${userQueueNumber}
                    <br>
                    Queues ahead of you: ${remaining}
                </div>
            `;
        }
    }

    // Update display elements
    updateDisplay() {
        document.getElementById('displayQueueNumber').textContent = this.currentQueue;
        document.getElementById('displayTotalQueues').textContent = this.totalQueues;
        document.getElementById('displayServedQueues').textContent = this.servedQueues;
        document.getElementById('displayRemainingQueues').textContent = Math.max(0, this.totalQueues - this.currentQueue);

        // Update status
        const statusElement = document.getElementById('queueStatus');
        if (this.currentQueue === 0) {
            statusElement.textContent = 'No active queue';
            statusElement.style.color = '#6c757d';
        } else if (this.currentQueue >= this.totalQueues) {
            statusElement.textContent = 'All queues served';
            statusElement.style.color = '#4CAF50';
        } else {
            statusElement.textContent = 'Queue in progress';
            statusElement.style.color = '#2196F3';
        }

        // Update queue number color based on status
        const queueNumberElement = document.getElementById('displayQueueNumber');
        if (this.currentQueue === 0) {
            queueNumberElement.style.color = '#6c757d';
            queueNumberElement.style.borderColor = '#6c757d';
        } else {
            queueNumberElement.style.color = '#4CAF50';
            queueNumberElement.style.borderColor = '#4CAF50';
        }

        // Add last updated time
        const lastUpdated = this.getLastUpdatedTime();
        if (lastUpdated) {
            const timeElement = document.getElementById('lastUpdated') || this.createLastUpdatedElement();
            timeElement.textContent = `Last updated: ${lastUpdated}`;
        }
    }

    // Create last updated element if it doesn't exist
    createLastUpdatedElement() {
        const element = document.createElement('p');
        element.id = 'lastUpdated';
        element.style.cssText = `
            color: #6c757d;
            font-size: 0.9rem;
            font-style: italic;
            margin-top: 10px;
        `;
        document.querySelector('.queue-info-display').appendChild(element);
        return element;
    }

    // Get last updated time
    getLastUpdatedTime() {
        const savedData = localStorage.getItem('queueData');
        if (savedData) {
            const data = JSON.parse(savedData);
            if (data.lastUpdated) {
                return new Date(data.lastUpdated).toLocaleString();
            }
        }
        return null;
    }

    // Refresh data manually
    refreshData() {
        this.loadQueueData();
        this.updateDisplay();
        this.showNotification('Data refreshed!', 'success');
    }

    // Start auto-refresh every 5 seconds
    startAutoRefresh() {
        setInterval(() => {
            this.loadQueueData();
            this.updateDisplay();
        }, 5000);
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#4CAF50';
                break;
            case 'error':
                notification.style.backgroundColor = '#f44336';
                break;
            case 'info':
                notification.style.backgroundColor = '#2196F3';
                break;
            default:
                notification.style.backgroundColor = '#6c757d';
        }
        
        // Add animation CSS if not already added
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add to document
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the queue display when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new QueueDisplay();
});