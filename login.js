class QueueLogin {
    constructor() {
        this.authFile = 'queue-auth.json';
        this.init();
    }

    init() {
        this.initializeEventListeners();
        this.checkExistingSession();
    }

    // Simple encryption function (Base64 + character shifting)
    encryptPassword(password) {
        // Step 1: Convert to Base64
        let encrypted = btoa(password);
        
        // Step 2: Character shifting (Caesar cipher with shift of 7)
        let shifted = '';
        for (let i = 0; i < encrypted.length; i++) {
            let char = encrypted.charCodeAt(i);
            // Shift character by 7 positions
            shifted += String.fromCharCode(char + 7);
        }
        
        // Step 3: Add random prefix and suffix to make it look more complex
        const prefix = 'QMS_';
        const suffix = '_' + Date.now().toString(36).slice(-4);
        
        return prefix + btoa(shifted) + suffix;
    }

    // Simple decryption function
    decryptPassword(encryptedPassword) {
        try {
            // Step 1: Remove prefix and suffix
            let cleaned = encryptedPassword;
            if (cleaned.startsWith('QMS_')) {
                cleaned = cleaned.substring(4);
            }
            const lastUnderscore = cleaned.lastIndexOf('_');
            if (lastUnderscore > 0) {
                cleaned = cleaned.substring(0, lastUnderscore);
            }
            
            // Step 2: Decode from Base64
            let shifted = atob(cleaned);
            
            // Step 3: Reverse character shifting
            let original = '';
            for (let i = 0; i < shifted.length; i++) {
                let char = shifted.charCodeAt(i);
                original += String.fromCharCode(char - 7);
            }
            
            // Step 4: Decode final Base64
            return atob(original);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    // Hash password for additional security (one-way)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }

    initializeEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('viewDisplayBtn').addEventListener('click', () => {
            window.location.href = 'queue-display.html';
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
                const storedPassword = authData.queues[queueName].password;
                const storedHash = authData.queues[queueName].passwordHash;
                
                let passwordMatch = false;
                
                // Try to decrypt stored password (new method)
                if (storedPassword && storedPassword.startsWith('QMS_')) {
                    const decryptedPassword = this.decryptPassword(storedPassword);
                    passwordMatch = (decryptedPassword === password);
                }
                // Fallback: check hash (for backward compatibility)
                else if (storedHash) {
                    passwordMatch = (this.hashPassword(password) === storedHash);
                }
                // Fallback: plain text comparison (old method)
                else {
                    passwordMatch = (storedPassword === password);
                    // Upgrade to encrypted storage
                    await this.upgradePasswordSecurity(queueName, password);
                }
                
                if (passwordMatch) {
                    // Update last accessed time
                    authData.queues[queueName].lastAccessed = new Date().toISOString();
                    await this.saveAuthData(authData);
                    
                    this.showMessage('Login successful! Redirecting...', 'success');
                    this.setSession(queueName);
                    setTimeout(() => {
                        window.location.href = `distributor.html?queue=${queueName}&password=${storedHash}_${password}_${storedPassword}`;
                    }, 1000);
                } else {
                    this.showMessage('Invalid password for existing queue', 'error');
                }
            } else {
                // New queue - create it
                await this.createNewQueue(queueName, password);
                this.showMessage('New queue created successfully! Redirecting...', 'success');
                const authData = await this.loadAuthData();
                this.setSession(queueName);
                setTimeout(() => {
                    window.location.href = `distributor.html?queue=${queueName}&password=${authData.queues[queueName].passwordHash}_${password}_${authData.queues[queueName].password}`;
                }, 1000);
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Login failed. Please try again.', 'error');
        }
    }

    // Upgrade old plain text passwords to encrypted storage
    async upgradePasswordSecurity(queueName, password) {
        try {
            const authData = await this.loadAuthData();
            if (authData.queues[queueName]) {
                authData.queues[queueName].password = this.encryptPassword(password);
                authData.queues[queueName].passwordHash = this.hashPassword(password);
                authData.queues[queueName].upgraded = new Date().toISOString();
                authData.lastUpdated = new Date().toISOString();
                await this.saveAuthData(authData);
                console.log(`Password security upgraded for queue: ${queueName}`);
            }
        } catch (error) {
            console.error('Failed to upgrade password security:', error);
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
        
        // Store encrypted password and hash
        authData.queues[queueName] = {
            password: this.encryptPassword(password),
            passwordHash: this.hashPassword(password),
            created: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            encrypted: true
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

        // Always save to localStorage (but encrypted)
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
        // Encrypt session data too
        const sessionData = {
            queue: queueName,
            loginTime: new Date().toISOString(),
            hash: this.hashPassword(queueName + new Date().toDateString())
        };
        
        sessionStorage.setItem('currentQueue', queueName);
        sessionStorage.setItem('loginTime', sessionData.loginTime);
        sessionStorage.setItem('sessionHash', sessionData.hash);
    }

    checkExistingSession() {
        const currentQueue = sessionStorage.getItem('currentQueue');
        const loginTime = sessionStorage.getItem('loginTime');
        const sessionHash = sessionStorage.getItem('sessionHash');
        
        if (currentQueue && loginTime && sessionHash) {
            // Verify session integrity
            const expectedHash = this.hashPassword(currentQueue + new Date(loginTime).toDateString());
            if (sessionHash !== expectedHash) {
                // Session might be tampered with, clear it
                this.clearSession();
                return;
            }
            
            // Check if session is less than 8 hours old
            const loginDate = new Date(loginTime);
            const now = new Date();
            const hoursDiff = (now - loginDate) / (1000 * 60 * 60);
            
            if (hoursDiff < 8) {
                this.showMessage(`Already logged in as: ${currentQueue}`, 'info');
                document.getElementById('queueName').value = currentQueue;
            } else {
                // Clear expired session
                this.clearSession();
            }
        }
    }

    clearSession() {
        sessionStorage.removeItem('currentQueue');
        sessionStorage.removeItem('loginTime');
        sessionStorage.removeItem('sessionHash');
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