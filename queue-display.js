// Queue display system for patients
class QueueDisplay {
    constructor() {
        this.currentQueue = 0;
        this.totalQueues = 0;
        this.callingQueue = 0;
        this.backup = null;
        this.queueName = null;
        this.userQueueNumber = null;
        this.authenticated = false;
        this.lastCalledTime = null;
        this.userQueueTimestamp = null; // Add this property to track user's queue creation time
        this.userQueueServedStatus = false;
        
        // First authenticate, then initialize if valid
        this.authenticateAccess();
    }

    // Authenticate access to queue display page
    async authenticateAccess() {
        try {
            console.log('🔐 Authenticating queue display access...');
            
            // Get URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const encryptedQueue = urlParams.get('queue');
            const encryptedNumber = urlParams.get('number');
            
            console.log('📝 URL parameters:', { 
                queue: encryptedQueue ? 'provided' : 'missing', 
                number: encryptedNumber ? 'provided' : 'missing' 
            });
            
            // Check if required parameters exist
            if (!encryptedQueue || !encryptedNumber) {
                console.log('❌ Missing required URL parameters');
                this.redirectToHome('Missing queue parameters');
                return;
            }
            
            // Decrypt parameters
            try {
                this.queueName = this.decryptUnicode(encryptedQueue);
                this.userQueueNumber = parseInt(this.decryptUnicode(encryptedNumber));
                
                console.log('🔓 Decrypted parameters:', {
                    queueName: this.queueName,
                    userQueueNumber: this.userQueueNumber
                });
                
                if (!this.queueName || isNaN(this.userQueueNumber) || this.userQueueNumber <= 0) {
                    throw new Error('Invalid decrypted data');
                }
            } catch (error) {
                console.log('❌ Failed to decrypt URL parameters:', error);
                this.redirectToHome('Invalid queue parameters');
                return;
            }
            
            // Load authentication data and verify queue exists
            const authData = await this.loadAuthData();
            
            // Check if queue exists in auth data
            if (!authData.queues || !authData.queues[this.queueName]) {
                console.log('❌ Queue not found in authentication data');
                this.redirectToHome('Queue not found or expired');
                return;
            }
            
            // Authentication successful
            console.log('✅ Authentication successful');
            this.authenticated = true;
            
            // Initialize the queue system
            await this.initializeBackup();
            
        } catch (error) {
            console.error('❌ Authentication error:', error);
            this.redirectToHome('Authentication system error');
        }
    }

    // Decrypt unicode function (same as in distributor.js)
    decryptUnicode(enc) {
        try {
            const SECRET_KEY = 129;
            let binary = atob(enc);
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            const decrypted = bytes.map(b => b ^ SECRET_KEY);
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw error;
        }
    }

    // Load authentication data
    async loadAuthData() {
        try {
            // Try to fetch from server first
            const response = await fetch('/queue-auth.json');
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.log('Server not available, checking localStorage');
        }

        // Fallback to localStorage
        const localData = localStorage.getItem('queueAuth');
        if (localData) {
            return JSON.parse(localData);
        }

        // Default structure if no data exists
        return {
            queues: {},
            lastUpdated: new Date().toISOString()
        };
    }

    // Redirect to home page with message
    redirectToHome(reason = 'Access denied') {
        console.log('🔄 Redirecting to home:', reason);
        
        // Show brief message before redirect
        document.body.innerHTML = `
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                font-family: Arial, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-align: center;
                flex-direction: column;
            ">
                <div style="
                    background: rgba(255,255,255,0.1);
                    padding: 30px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.2);
                ">
                    <h2 style="margin: 0 0 15px 0;">🎫 Queue Access Required</h2>
                    <p style="margin: 0 0 20px 0;">${reason}</p>
                    <p style="margin: 0; opacity: 0.8; font-size: 14px;">Please use a valid QR code to access queue information</p>
                </div>
            </div>
        `;
        
        // Redirect after 3 seconds
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 3000);
    }

    // Initialize backup system and load data
    async initializeBackup() {
        if (!this.authenticated) return;
        
        try {
            console.log(`🔄 Initializing backup system for queue: ${this.queueName}`);
            this.backup = new SimpleQueueBackup(this.queueName);
            await this.backup.init();
            this.loadQueueData();
            this.initializeEventListeners();
            this.updateDisplay();
            this.startAutoRefresh();
            this.showAuthenticationStatus();
            console.log('✅ Backup system ready');
        } catch (error) {
            console.error('❌ Backup initialization failed:', error);
            this.initializeEventListeners();
            this.updateDisplay();
            this.startAutoRefresh();
        }
    }

    // Show authentication status
    showAuthenticationStatus() {
        const authStatusDiv = document.createElement('div');
        authStatusDiv.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(76, 175, 80, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            ">
                🎫 Queue: <strong>${this.queueName}</strong><br>
                <small>Your number: ${this.userQueueNumber}</small>
            </div>
        `;
        document.body.appendChild(authStatusDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (authStatusDiv.parentNode) {
                authStatusDiv.parentNode.removeChild(authStatusDiv);
            }
        }, 5000);
    }

    // Load queue data from backup
    loadQueueData() {
        if (!this.authenticated || !this.backup) return;
        
        if (this.backup) {
            const status = this.backup.getCurrentStatus();
            const userQueue = this.backup.getQueue(this.userQueueNumber);
            
            this.currentQueue = status.currentQueue;
            this.totalQueues = status.totalQueues;
            this.callingQueue = status.callingQueue;
            this.lastCalledTime = status.lastCalled;
            
            // Get user's queue timestamp if available
            if (userQueue && userQueue.timestamp) {
                this.userQueueTimestamp = userQueue.timestamp;
                this.userQueueServed = userQueue.served;
                console.log(`🕒 User queue ${this.userQueueNumber} created at: ${this.userQueueTimestamp}`);
            } else {
                console.log(`⚠️ No timestamp found for queue ${this.userQueueNumber}`);
            }
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        if (!this.authenticated) return;
        
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        // Listen for storage changes (when distributor updates data)
        window.addEventListener('storage', (e) => {
            if (e.key === `queueBackup_${this.queueName}`) {
                this.loadQueueData();
                this.updateDisplay();
            }
        });
    }

    // Update display elements
    updateDisplay() {
        if (!this.authenticated) return;
        
        // Update queue name
        const queueNameElement = document.getElementById('queueName');
        if (queueNameElement) {
            queueNameElement.textContent = this.queueName;
        }
        
        // Update current calling queue
        document.getElementById('displayQueueNumber').textContent = this.callingQueue || 0;
        
        // Update or create last called time display
        this.updateLastCalledTimeDisplay();
        
        // Update user-specific status
        this.updateUserQueueStatus();

        // Update queue number color based on status
        const queueNumberElement = document.getElementById('displayQueueNumber');
        if (this.callingQueue === 0) {
            queueNumberElement.style.color = '#6c757d';
            queueNumberElement.style.borderColor = '#6c757d';
        } else {
            queueNumberElement.style.color = '#4CAF50';
            queueNumberElement.style.borderColor = '#4CAF50';
        }
    }

    // Update or create last called time display
    updateLastCalledTimeDisplay() {
        // Create or update last called time element
        let lastCalledElement = document.getElementById('lastCalledTime');
        if (!lastCalledElement) {
            lastCalledElement = document.createElement('div');
            lastCalledElement.id = 'lastCalledTime';
            lastCalledElement.style.cssText = `
                color: #6c757d;
                font-size: 14px;
                font-style: italic;
                margin: 10px 0;
                text-align: center;
                background: rgba(108, 117, 125, 0.1);
                padding: 8px 15px;
                border-radius: 5px;
                border: 1px solid rgba(108, 117, 125, 0.2);
            `;
            
            // Insert after the queue number
            const queueNumber = document.getElementById('displayQueueNumber');
            if (queueNumber) {
                queueNumber.parentNode.insertBefore(lastCalledElement, queueNumber.nextSibling);
            }
        }

        // Update content based on calling queue status
        if (this.lastCalledTime === "-") {
            lastCalledElement.innerHTML = `
                <div style="color: #6c757d;">
                    ⏳ <strong>Waiting for first queue to be called</strong>
                </div>
            `;
        } else if (this.lastCalledTime) {
            const callTime = new Date(this.lastCalledTime);
            const timeAgo = this.getTimeAgo(callTime);
            
            lastCalledElement.innerHTML = `
                <div style="color: #4CAF50;">
                    🕒 <strong>Last Call at:</strong> ${callTime.toLocaleTimeString()}
                    <br>
                    <small style="color: #666;">${timeAgo}</small>
                </div>
            `;
        } else {
            lastCalledElement.innerHTML = `
                <div style="color: #6c757d;">
                    🕒 <strong>Queue ${this.callingQueue} is currently being served</strong>
                </div>
            `;
        }
    }

    // Calculate total waiting time for user's queue
    getTotalWaitingTime() {
        if (!this.userQueueTimestamp) {
            return null;
        }
        
        const queueCreatedTime = new Date(this.userQueueTimestamp);
        if (!this.userQueueServed) {
            this.now = new Date();
        }
        else if (!this.userQueueServedStatus) {
            this.now = new Date(this.lastCalledTime);
            this.userQueueServedStatus = true;
        }
        const totalWaitingMs = this.now - queueCreatedTime;

        return {
            totalMs: totalWaitingMs,
            formatted: this.formatWaitingTime(totalWaitingMs)
        };
    }

    // Format waiting time into readable format
    formatWaitingTime(totalMs) {
        const totalSeconds = Math.floor(totalMs / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        const days = Math.floor(totalHours / 24);
        
        const hours = totalHours % 24;
        const minutes = totalMinutes % 60;
        const seconds = totalSeconds % 60;
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (totalHours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (totalMinutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Get time ago string (e.g., "2 minutes ago")
    getTimeAgo(callTime) {
        const now = new Date();
        const diffMs = now - callTime;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);

        if (diffSeconds < 60) {
            return diffSeconds <= 5 ? 'Just now' : `${diffSeconds} seconds ago`;
        } else if (diffMinutes < 60) {
            return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else {
            return callTime.toLocaleDateString();
        }
    }

    // Update user-specific queue status
    updateUserQueueStatus() {
        // Create or update user status section
        let userStatusDiv = document.getElementById('userQueueStatus');
        if (!userStatusDiv) {
            userStatusDiv = document.createElement('div');
            userStatusDiv.id = 'userQueueStatus';
            userStatusDiv.style.cssText = `
                background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                border: 2px solid #dee2e6;
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
                font-size: 18px;
                font-weight: bold;
            `;
            
            // Insert after last called time display
            const lastCalledElement = document.getElementById('lastCalledTime');
            if (lastCalledElement) {
                lastCalledElement.parentNode.insertBefore(userStatusDiv, lastCalledElement.nextSibling);
            } else {
                // Fallback: insert after queue number
                const queueNumber = document.getElementById('displayQueueNumber');
                if (queueNumber) {
                    queueNumber.parentNode.insertBefore(userStatusDiv, queueNumber.nextSibling);
                } else {
                    document.querySelector('.queue-display').appendChild(userStatusDiv);
                }
            }
        }

        // Get total waiting time
        const waitingTime = this.getTotalWaitingTime();
        const waitingTimeDisplay = waitingTime ? 
            `<div style="color: #666; font-size: 14px; margin-top: 8px;">
                ⏰ Total waiting time: <strong>${waitingTime.formatted}</strong>
            </div>` : '';

        // Update user status content
        if (this.userQueueNumber <= (this.callingQueue || 0)) {
            userStatusDiv.innerHTML = `
                <div style="color: #4CAF50;">
                    ✅ <strong style="font-size: 25px;">
                            Your queue number ${this.userQueueNumber} has been called!
                        </strong>
                    <br>
                    <small style="color: #0f421aff; font-weight: normal; font-size: 20px; margin-top: 8px; display: block;">Please proceed to the service counter</small>
                    ${waitingTimeDisplay}
                </div>
            `;
            userStatusDiv.style.borderColor = '#4CAF50';
            userStatusDiv.style.background = 'linear-gradient(135deg, #e8f5e8, #d4edda)';
        } else {
            const remaining = this.userQueueNumber - (this.callingQueue || 0);
            userStatusDiv.innerHTML = `
                <div style="color: #2196F3;">
                    🎫 <strong style="font-size: 25px;">
                            Your queue number: ${this.userQueueNumber}
                        </strong>
                    <br>
                    <small style="color: ${remaining > 3 ? '#666;' : '#b11919ff;'} font-weight: normal; font-size: 20px; margin-top: 8px; display: block;">
                        ${remaining} queue${remaining > 1 ? 's' : ''} ahead of you
                    </small>
                    ${waitingTimeDisplay}
                </div>
            `;
            userStatusDiv.style.borderColor = '#2196F3';
            userStatusDiv.style.background = 'linear-gradient(135deg, #e3f2fd, #bbdefb)';
        }
    }

    // Refresh data manually
    refreshData() {
        if (!this.authenticated) return;
        
        this.loadQueueData();
        this.updateDisplay();
        this.showNotification('Data refreshed!', 'success');
    }

    // Start auto-refresh every 5 seconds
    startAutoRefresh() {
        if (!this.authenticated) return;
        
        setInterval(() => {
            this.loadQueueData();
            this.updateDisplay();
            
            // Update time ago display every refresh
            this.updateLastCalledTimeDisplay();
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