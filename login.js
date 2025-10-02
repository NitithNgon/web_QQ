class QueueLogin {
    constructor() {
        this.authFile = 'queue-auth.json';
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.checkExistingSession();
    }

    initializeEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Clear any previous error messages when user types
        document.getElementById('queueName').addEventListener('input', () => {
            this.hideMessage();
        });
        document.getElementById('password').addEventListener('input', () => {
            this.hideMessage();
        });
    }

    async handleLogin() {
        const queueName = document.getElementById('queueName').value.trim();
        const password = document.getElementById('password').value;

        if (!queueName || !password) {
            this.showMessage('Please enter both queue name and password', 'error');
            return;
        }
        // Validate queue name format - allow Thai letters, English letters, numbers, hyphens, and underscores
        if (!/^[a-zA-Z0-9\u0E00-\u0E7F\-_\s]+$/.test(queueName)) {
            this.showMessage('Queue name can only contain Thai letters, English letters, numbers, hyphens, underscores, and spaces', 'error');
            return;
        }

        // Validate password format - allow only English letters and numbers, 4-20 characters
        if (!/^[a-zA-Z0-9]{4,20}$/.test(password)) {
            this.showMessage('Password must be 4-20 characters long and contain only English letters and numbers', 'error');
            return;
        }

        try {
            this.showMessage('Authenticating...', 'info');
            
            const authData = await this.loadAuthData();
            
            if (authData.queues[queueName]) {
                // Existing queue - check password
                if (authData.queues[queueName].password === password) {
                    this.showMessage('Login successful! Redirecting...', 'success');
                    this.setSession(queueName);
                    setTimeout(() => {
                        window.location.href = `distributor.html?queue=${queueName}`;
                    }, 1000);
                } else {
                    this.showMessage('Invalid password for existing queue', 'error');
                }
            } else {
                // New queue - create it
                await this.createNewQueue(queueName, password);
                this.showMessage('New queue created successfully! Redirecting...', 'success');
                this.setSession(queueName);
                setTimeout(() => {
                    window.location.href = `distributor.html?queue=${queueName}`;
                }, 1000);
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Login failed. Please try again.', 'error');
        }
    }

    async loadAuthData() {
        try {
            // Try to fetch from server first
            const response = await fetch(this.authFile);
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

    async createNewQueue(queueName, password) {
        const authData = await this.loadAuthData();
        
        authData.queues[queueName] = {
            password: password,
            created: new Date().toISOString(),
            lastAccessed: new Date().toISOString()
        };
        authData.lastUpdated = new Date().toISOString();

        await this.saveAuthData(authData);
        
        // Also initialize the queue backup file for this queue
        await this.initializeQueueBackup(queueName);
    }

    async initializeQueueBackup(queueName) {
        const queueData = {
            queueName: queueName,
            currentQueue: 0,
            totalQueues: 0,
            callingQueue: 0,
            lastUpdated: new Date().toISOString(),
            queues: []
        };

        // Save to localStorage with queue-specific key
        localStorage.setItem(`queueBackup_${queueName}`, JSON.stringify(queueData));

        // Try to save to server
        try {
            await fetch('/api/save-queue-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    queueName: queueName,
                    data: queueData
                })
            });
        } catch (error) {
            console.log('Server save failed for queue backup');
        }
    }

    async saveAuthData(authData) {
        const jsonData = JSON.stringify(authData, null, 2);

        // Always save to localStorage
        localStorage.setItem('queueAuth', jsonData);

        // Try to save to server
        try {
            await fetch('/api/save-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: jsonData
            });
            console.log('Auth data saved to server');
        } catch (error) {
            console.log('Server save failed, using localStorage only');
        }
    }

    setSession(queueName) {
        sessionStorage.setItem('currentQueue', queueName);
        sessionStorage.setItem('loginTime', new Date().toISOString());
    }

    checkExistingSession() {
        const currentQueue = sessionStorage.getItem('currentQueue');
        const loginTime = sessionStorage.getItem('loginTime');
        
        if (currentQueue && loginTime) {
            // Check if session is less than 8 hours old
            const loginDate = new Date(loginTime);
            const now = new Date();
            const hoursDiff = (now - loginDate) / (1000 * 60 * 60);
            
            if (hoursDiff < 8) {
                this.showMessage(`Already logged in as: ${currentQueue}`, 'info');
                document.getElementById('queueName').value = currentQueue;
            } else {
                // Clear expired session
                sessionStorage.removeItem('currentQueue');
                sessionStorage.removeItem('loginTime');
            }
        }
    }

    showMessage(message, type) {
        const messageDiv = document.getElementById('loginMessage');
        messageDiv.textContent = message;
        messageDiv.className = `message message-${type}`;
        messageDiv.style.display = 'block';
    }

    hideMessage() {
        document.getElementById('loginMessage').style.display = 'none';
    }
}

// Initialize login system when page loads
document.addEventListener('DOMContentLoaded', () => {
    new QueueLogin();
});