// Queue management system for distributor
class QueueManager {
    constructor() {
        this.currentQueue = 0;
        this.totalQueues = 0;
        this.callingQueue = 0;
        this.backup = null;
        this.queueName = null;
        this.lastUpdated = null;
        
        // First authenticate, then initialize if valid
        this.authenticateAccess();
    }

    // Authenticate access to distributor page
    async authenticateAccess() {
        try {
            console.log('🔐 Authenticating distributor access...');
            
            // Get URL parameters
            const urlParams = new URLSearchParams(window.location.search);
            const queueParam = urlParams.get('queue');
            const passwordParam = urlParams.get('password');
            
            console.log('📝 URL parameters:', { queue: queueParam, password: passwordParam ? 'provided' : 'missing' });
            
            // Check if required parameters exist
            if (!queueParam || !passwordParam) {
                console.log('❌ Missing required URL parameters');
                this.redirectToLogin('Missing authentication parameters');
                return;
            }
            
            // Parse password parameter (format: storedHash_password_storedPassword)
            const passwordParts = passwordParam.split('_');
            if (passwordParts.length < 3) {
                console.log('❌ Invalid password parameter format');
                this.redirectToLogin('Invalid authentication format');
                return;
            }
            
            const storedHash = passwordParts[0];
            const plainPassword = passwordParts[1];
            const storedPassword = passwordParts.slice(2).join('_'); // In case stored password contains underscores
            
            console.log('🔍 Parsed authentication data:', {
                queue: queueParam,
                storedHash: storedHash,
                plainPassword: plainPassword ? 'provided' : 'missing',
                storedPassword: storedPassword ? 'provided' : 'missing'
            });
            
            // Load authentication data from server
            const authData = await this.loadAuthData();
            
            // Check if queue exists in auth data
            if (!authData.queues || !authData.queues[queueParam]) {
                console.log('❌ Queue not found in authentication data');
                this.redirectToLogin('Queue not found');
                return;
            }
            
            const queueAuthData = authData.queues[queueParam];
            console.log('📖 Queue auth data found');
            
            // Verify authentication parameters
            const isValid = await this.verifyAuthentication(
                queueParam, 
                plainPassword, 
                storedHash, 
                storedPassword, 
                queueAuthData
            );
            
            if (!isValid) {
                console.log('❌ Authentication verification failed');
                this.redirectToLogin('Invalid authentication credentials');
                return;
            }
            
            // Authentication successful
            console.log('✅ Authentication successful');
            this.queueName = queueParam;
            
            // Update last accessed time
            queueAuthData.lastAccessed = new Date().toISOString();
            await this.saveAuthData(authData);
            
            // Set session
            this.setSession(queueParam);
            
            // Initialize the queue system
            await this.initializeBackup();
            
        } catch (error) {
            console.error('❌ Authentication error:', error);
            this.redirectToLogin('Authentication system error');
        }
    }

    // Verify authentication parameters
    async verifyAuthentication(queueName, plainPassword, providedHash, providedStoredPassword, queueAuthData) {
        try {
            console.log('🔍 Verifying authentication...');
            
            // Get stored data
            const actualStoredPassword = queueAuthData.password;
            const actualStoredHash = queueAuthData.passwordHash;
            
            console.log('📊 Verification data:', {
                actualStoredHash: actualStoredHash,
                providedHash: providedHash,
                actualStoredPassword: actualStoredPassword ? 'exists' : 'missing',
                providedStoredPassword: providedStoredPassword ? 'exists' : 'missing'
            });
            
            // Verify hash matches
            if (actualStoredHash !== providedHash) {
                console.log('❌ Hash verification failed');
                return false;
            }
            
            // Verify stored password matches
            if (actualStoredPassword !== providedStoredPassword) {
                console.log('❌ Stored password verification failed');
                return false;
            }
            
            // Verify plain password can be decrypted and matches
            let passwordMatches = false;
            
            // Try to decrypt stored password (new method)
            if (actualStoredPassword && actualStoredPassword.startsWith('QMS_')) {
                const decryptedPassword = this.decryptPassword(actualStoredPassword);
                passwordMatches = (decryptedPassword === plainPassword);
                console.log('🔓 Password decryption check:', passwordMatches ? 'passed' : 'failed');
            }
            // Fallback: check hash (for backward compatibility)
            else if (actualStoredHash) {
                passwordMatches = (this.hashPassword(plainPassword) === actualStoredHash);
                console.log('🔐 Password hash check:', passwordMatches ? 'passed' : 'failed');
            }
            
            if (!passwordMatches) {
                console.log('❌ Password verification failed');
                return false;
            }
            
            console.log('✅ All authentication checks passed');
            return true;
            
        } catch (error) {
            console.error('❌ Error during authentication verification:', error);
            return false;
        }
    }

    // Simple decryption function (copied from login.js)
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

    // Hash password for additional security (copied from login.js)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
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

    // Save authentication data
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

    // Set session data
    setSession(queueName) {
        const sessionData = {
            queue: queueName,
            loginTime: new Date().toISOString(),
            hash: this.hashPassword(queueName + new Date().toDateString())
        };
        
        sessionStorage.setItem('currentQueue', queueName);
        sessionStorage.setItem('loginTime', sessionData.loginTime);
        sessionStorage.setItem('sessionHash', sessionData.hash);
    }

    // Redirect to login page with message
    redirectToLogin(reason = 'Authentication required') {
        console.log('🔄 Redirecting to login:', reason);
        
        // Clear any existing session
        sessionStorage.clear();
        localStorage.removeItem('queueAuth');
        
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
                    <h2 style="margin: 0 0 15px 0;">🔐 Authentication Required</h2>
                    <p style="margin: 0 0 20px 0;">${reason}</p>
                    <p style="margin: 0; opacity: 0.8; font-size: 14px;">Redirecting to login page...</p>
                </div>
            </div>
        `;
        
        // Redirect after 2 seconds
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 2000);
    }

    // Initialize backup system and load data
    async initializeBackup() {
        try {
            console.log(`🔄 Initializing backup system for queue: ${this.queueName}`);
            this.backup = new SimpleQueueBackup(this.queueName);
            await this.backup.init();
            this.loadQueueData();
            this.initializeEventListeners();
            this.updateDisplay();
            this.showAuthenticationStatus();
            console.log('✅ Backup system ready');
        } catch (error) {
            console.error('❌ Backup initialization failed:', error);
            this.initializeEventListeners();
            this.updateDisplay();
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
                padding: 10px 15px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            ">
                ✅ Authenticated as: <strong>${this.queueName}</strong>
                <br>
                <small>Session: ${new Date().toLocaleTimeString()}</small>
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
        if (this.backup) {
            const status = this.backup.getCurrentStatus();
            this.currentQueue = status.currentQueue;
            this.totalQueues = status.totalQueues;
            this.callingQueue = status.callingQueue;
            this.lastUpdated = status.lastUpdated;
            if (this.currentQueue > 0) {
                this.generateQRCode();
            }
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Add logout button functionality
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = '🚪 Logout';
        logoutBtn.className = 'btn btn-secondary';
        logoutBtn.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1001;
        `;
        logoutBtn.addEventListener('click', () => this.logout());
        document.body.appendChild(logoutBtn);

        document.getElementById('newQueueBtn').addEventListener('click', () => {
            this.generateNewQueue();
        });
        
        const callQueueBtn = document.getElementById('callQueueBtn');
        if (callQueueBtn) {
            callQueueBtn.addEventListener('click', () => {
                this.callNextQueue();
            });
        }

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetAllQueues();
        });

        // Delete current queue only
        document.getElementById('deleteAllBtn').addEventListener('click', () => {
            console.log('Delete current queue button clicked');
            this.deleteCurrentQueue();
        });
        
        document.getElementById('printBtn').addEventListener('click', () => {
            this.printQRCode();
        });
    }

    // Logout function
    logout() {
        if (confirm('Are you sure you want to logout?')) {
            console.log('🚪 User logging out...');
            sessionStorage.clear();
            window.location.href = '/index.html';
        }
    }

    // Generate new queue number
    async generateNewQueue() {
        // Prevent multiple rapid clicks
        const newQueueBtn = document.getElementById('newQueueBtn');
        if (newQueueBtn.disabled) return;

        newQueueBtn.disabled = true;
        newQueueBtn.textContent = 'Generating...';

        try {
            // Increment queue numbers
            const newQueueNumber = this.currentQueue + 1;
            
            // Save to backup system first
            if (this.backup) {
                await this.backup.addQueue(newQueueNumber);
                console.log(`Queue ${newQueueNumber} saved to backup for ${this.queueName}`);
                
                // Reload data from backup to ensure sync
                this.loadQueueData();
            } else {
                // Fallback if no backup system
                this.currentQueue = newQueueNumber;
                this.totalQueues++;
            }
            
            this.updateDisplay();
            
            // Show success message
            this.showNotification(`Queue ${this.currentQueue} generated for ${this.queueName}!`, 'success');
        } catch (error) {
            console.error('Failed to generate queue:', error);
            this.showNotification('Failed to generate queue', 'error');
        } finally {
            // Re-enable button
            setTimeout(() => {
                newQueueBtn.disabled = false;
                newQueueBtn.textContent = '🎫 New Queue';
            }, 500);
        }
    }

    // Call next queue number
    async callNextQueue() {
        if (this.callingQueue >= this.currentQueue) {
            this.showNotification('No more queues to call', 'info');
            return;
        }
        this.callingQueue++;
        this.totalQueues--;
        if (this.backup) {
            await this.backup.endQueue(this.callingQueue);
            console.log(`Queue ${this.callingQueue} ended in backup`);
        }
        this.updateDisplay();
        this.showNotification(`Calling Queue ${this.callingQueue}`, 'info');
    }

    // Reset all queues
    async resetAllQueues() {
        if (confirm(`Are you sure you want to reset all queues for "${this.queueName}"? This action cannot be undone.`)) {
            try {
                if (this.backup) {
                    await this.backup.resetQueues();
                }
                this.currentQueue = 0;
                this.callingQueue = 0;
                this.totalQueues = 0;
                this.updateDisplay();
                this.hideQRSection();
                
                // Show reset message
                this.showNotification(`All queues have been reset for ${this.queueName}!`, 'info');
            } catch (error) {
                console.error('Failed to reset queues:', error);
                this.showNotification('Failed to reset queues', 'error');
            }
        }
    }
    
    // Delete current queue and associated data
    async deleteCurrentQueue() {
        if (confirm(`Are you sure you want to delete queue "${this.queueName}"? This will remove it from the system and log you out.`)) {
            try {
                console.log('Starting delete current queue process...');
                
                // Delete backup file from server
                console.log(`Deleting backup file for queue: ${this.queueName}`);
                await this.deleteQueueBackupFile(this.queueName);
                
                // Remove queue from authentication file (not delete entire file)
                console.log('Removing queue from authentication file...');
                await this.deleteAuthFile(); // This now removes just this queue
                
                // Clear browser storage for this queue
                console.log('Clearing browser storage for this queue...');
                localStorage.removeItem(`queueBackup_${this.queueName}`);
                localStorage.removeItem('queueAuth'); // Will be reloaded for remaining queues
                sessionStorage.clear();
                
                // Show success message and redirect
                this.showNotification(`Queue "${this.queueName}" deleted successfully! Redirecting to login...`, 'success');
                
                // Redirect to login page after 2 seconds
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 2000);
                
            } catch (error) {
                console.error('Failed to delete current queue:', error);
                this.showNotification('Failed to delete queue: ' + error.message, 'error');
            }
        }
    }
    
    // Delete queue backup file from server
    async deleteQueueBackupFile(queueName) {
        try {
            // Encode the queue name for URL
            const encodedQueueName = encodeURIComponent(queueName);
            console.log(`Requesting server to delete backup file for: ${queueName} (encoded: ${encodedQueueName})`);
            
            const response = await fetch(`/api/delete-queue-backup/${encodedQueueName}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            console.log('Delete response status:', response.status);
            console.log('Delete response headers:', response.headers.get('content-type'));
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Queue backup file deleted:', result.message);
            } else {
                // Try to get error as text first, then parse as JSON
                const responseText = await response.text();
                console.log('Raw response:', responseText);
                
                try {
                    const errorData = JSON.parse(responseText);
                    console.warn('⚠️ Server delete warning:', errorData.error);
                } catch {
                    console.error('❌ Server returned non-JSON response:', responseText);
                    throw new Error('Server returned invalid response');
                }
            }
        } catch (error) {
            console.error('❌ Network error deleting backup file:', error);
            throw error;
        }
    }

    // Delete authentication file from server (remove specific queue)
    async deleteAuthFile() {
        try {
            console.log(`🗑️ Requesting removal of queue "${this.queueName}" from auth file`);
            
            const requestBody = { queueName: this.queueName };
            console.log('📤 Request body:', JSON.stringify(requestBody));
            
            const response = await fetch('/api/delete-queue-auth', {
                method: 'DELETE',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            console.log('📡 Response status:', response.status);
            console.log('📡 Response content-type:', response.headers.get('content-type'));
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const responseText = await response.text();
                console.error('❌ Server returned non-JSON response:', responseText.substring(0, 200));
                throw new Error('Server returned HTML instead of JSON - check server routing');
            }
            
            const responseText = await response.text();
            console.log('📡 Raw response:', responseText);
            
            if (response.ok) {
                const result = JSON.parse(responseText);
                console.log('✅ Queue removed from auth file:', result.message);
            } else {
                const errorData = JSON.parse(responseText);
                console.warn('⚠️ Server delete warning:', errorData.error);
                throw new Error(errorData.error);
            }
        } catch (error) {
            console.error('❌ Error removing queue from auth file:', error);
            throw error;
        }
    }

    // Update display elements
    updateDisplay() {
        const queueNameElement = document.getElementById('queueName');
        if (queueNameElement) {
            queueNameElement.textContent = this.queueName;
        }
        
        document.getElementById('currentQueue').textContent = this.currentQueue;
        document.getElementById('totalQueues').textContent = this.totalQueues;
        
        const callingQueueElement = document.getElementById('callingQueue');
        if (callingQueueElement) {
            callingQueueElement.textContent = this.callingQueue;
        }
    }

    // Generate QR code
    generateQRCode() {
        const qrSection = document.getElementById('qrSection');
        const qrCodeDiv = document.getElementById('qrcode');
        
        // Clear previous QR code
        qrCodeDiv.innerHTML = '';
        
        // Create QR code data
        const qrData = {
            queueNumber: this.currentQueue,
            timestamp: this.lastUpdated,
            url: window.location.origin + '/queue-display.html?queue=' + this.encryptUnicode(this.queueName) + '&number=' + this.encryptUnicode(this.currentQueue),
        };
        
        // Check if QRCode library is available
        if (typeof QRCode === 'undefined') {
            console.warn('QRCode library not loaded, using fallback');
            this.createFallbackQRCode(qrCodeDiv, qrData);
            qrSection.style.display = 'block';
            return;
        }
        
        try {
            // qrcodejs library usage - creates QR code as DOM element
            const qr = new QRCode(qrCodeDiv, {
                text: JSON.stringify(qrData),
                width: 256,
                height: 256,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
            
            console.log('QR Code generated successfully');
            qrSection.style.display = 'block';
            
        } catch (error) {
            console.error('QRCode library error:', error);
            this.createFallbackQRCode(qrCodeDiv, qrData);
            qrSection.style.display = 'block';
        }
    }

    encryptUnicode(str) {
        const SECRET_KEY = 129;
        const encoder = new TextEncoder();
        const bytes = encoder.encode(str); // UTF-8 bytes
        const encrypted = bytes.map(b => b ^ SECRET_KEY); // XOR each byte
        // convert to Base64 (shorter than hex)
        let binary = String.fromCharCode(...encrypted);
        return btoa(binary);
    }

    decryptUnicode(enc) {
        const SECRET_KEY = 129;
        let binary = atob(enc);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        const decrypted = bytes.map(b => b ^ SECRET_KEY);
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    // Create fallback QR code when library fails
    createFallbackQRCode(container, qrData) {
        container.innerHTML = `
            <div style="
                width: 256px; 
                height: 256px; 
                border: 3px solid #0066cc; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                background: linear-gradient(45deg, #f0f8ff, #e6f3ff); 
                margin: 0 auto;
                flex-direction: column;
                font-family: Arial, sans-serif;
                border-radius: 10px;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            ">
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #0066cc;">${qrData.queueName}</div>
                <div style="font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #0066cc;">🎫 Queue Ticket</div>
                <div style="font-size: 36px; color: #ff4444; font-weight: bold; margin-bottom: 10px;">Queue #${qrData.queueNumber}</div>
                <div style="font-size: 14px; margin-top: 15px; text-align: center; color: #666; line-height: 1.4;">
                    Generated: ${new Date(qrData.timestamp).toLocaleString()}<br>
                    <strong>Keep this ticket</strong><br>
                    Wait for your number to be called
                </div>
            </div>
        `;
        
        this.showNotification('Queue ticket generated (fallback mode)', 'info');
    }

    // Hide QR section
    hideQRSection() {
        document.getElementById('qrSection').style.display = 'none';
    }

    // Print QR code
    printQRCode() {
        const printWindow = window.open('', '_blank');
        const qrCodeDiv = document.getElementById('qrcode');
        const currentDate = new Date().toLocaleDateString();
        const currentTime = new Date().toLocaleTimeString();
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Queue QR Code - ${this.queueName} #${this.currentQueue}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 20px;
                        margin: 0;
                        background: white;
                    }
                    .print-header {
                        margin-bottom: 30px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 15px;
                        text-align: center;
                    }
                    .print-header h1 {
                        margin: 0 0 10px 0;
                        font-size: 24px;
                        text-align: center;
                    }
                    .print-header p {
                        margin: 0;
                        font-size: 14px;
                        color: #666;
                        text-align: center;
                    }
                    .queue-info {
                        font-size: 20px;
                        margin: 20px 0;
                        font-weight: bold;
                        text-align: center;
                    }
                    .queue-info h2 {
                        margin: 0;
                        text-align: center;
                    }
                    .qr-title {
                        font-size: 18px;
                        font-weight: bold;
                        margin: 20px 0 15px 0;
                        text-align: center;
                        color: #333;
                    }
                    .qr-container {
                        margin: 20px auto;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 280px;
                        width: 100%;
                    }
                    .qr-container > div {
                        margin: 0 auto;
                        text-align: center;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        flex-direction: column;
                    }
                    .qr-container img,
                    .qr-container canvas {
                        display: block;
                        margin: 0 auto;
                        border: 2px solid #ddd;
                        border-radius: 8px;
                    }
                    .instructions {
                        margin-top: 30px;
                        font-size: 14px;
                        color: #666;
                        line-height: 1.5;
                        text-align: center;
                    }
                    .instructions p {
                        margin: 8px 0;
                        text-align: center;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 15px;
                        }
                        .qr-container {
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>Queue Management System</h1>
                    <p>Queue: ${this.queueName} | Date: ${currentDate} | Time: ${currentTime}</p>
                </div>
                <div class="queue-info">
                    <h2>Queue Number: ${this.currentQueue}</h2>
                </div>
                <div class="qr-title">QR Code</div>
                <div class="qr-container">
                    ${qrCodeDiv.innerHTML}
                </div>
                <div class="instructions">
                    <p><strong>Scan this QR code to view your queue status</strong></p>
                    <p>Keep this slip until your number is called</p>
                    <p>Present this ticket at the counter when requested</p>
                </div>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        // Wait a moment for content to load, then print
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 1000);
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
            case 'warning':
                notification.style.backgroundColor = '#ff9800';
                break;
            default:
                notification.style.backgroundColor = '#6c757d';
        }
        
        // Add animation CSS
        const style = document.createElement('style');
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

// Initialize the queue manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new QueueManager();
});