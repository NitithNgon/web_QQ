// Queue management system for distributor
class QueueManager {
    constructor() {
        this.currentQueue = 0;
        this.totalQueues = 0;
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
            console.log('Backup system ready');
        } catch (error) {
            console.error('Backup initialization failed:', error);
            this.initializeEventListeners();
            this.updateDisplay();
        }
    }

    // Load queue data from backup
    loadQueueData() {
        if (this.backup) {
            const status = this.backup.getCurrentStatus();
            this.currentQueue = status.currentQueue;
            this.totalQueues = status.totalQueues;
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        document.getElementById('nextQueueBtn').addEventListener('click', () => {
            this.generateNextQueue();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetAllQueues();
        });

        document.getElementById('printBtn').addEventListener('click', () => {
            this.printQRCode();
        });
    }

    // Generate next queue number
    async generateNextQueue() {
        // Prevent multiple rapid clicks
        const nextQueueBtn = document.getElementById('nextQueueBtn');
        if (nextQueueBtn.disabled) return;
        
        nextQueueBtn.disabled = true;
        nextQueueBtn.textContent = 'Generating...';
        
        try {
            // Increment queue numbers
            const newQueueNumber = this.currentQueue + 1;
            
            // Save to backup system first
            if (this.backup) {
                await this.backup.addQueue(newQueueNumber);
                console.log(`Queue ${newQueueNumber} saved to backup`);
                
                // Reload data from backup to ensure sync
                this.loadQueueData();
            } else {
                // Fallback if no backup system
                this.currentQueue = newQueueNumber;
                this.totalQueues++;
            }
            
            this.updateDisplay();
            this.generateQRCode();
            
            // Show success message
            this.showNotification(`Queue ${this.currentQueue} generated and backed up!`, 'success');
        } catch (error) {
            console.error('Failed to generate queue:', error);
            this.showNotification('Failed to generate queue', 'error');
        } finally {
            // Re-enable button
            setTimeout(() => {
                nextQueueBtn.disabled = false;
                nextQueueBtn.textContent = 'Next Queue';
            }, 500);
        }
    }

    // Reset all queues
    async resetAllQueues() {
        if (confirm('Are you sure you want to reset all queues? This action cannot be undone.')) {
            try {
                if (this.backup) {
                    await this.backup.resetQueues();
                }
                
                this.currentQueue = 0;
                this.totalQueues = 0;
                this.updateDisplay();
                this.hideQRSection();
                
                // Show reset message
                this.showNotification('All queues have been reset!', 'info');
            } catch (error) {
                console.error('Failed to reset queues:', error);
                this.showNotification('Failed to reset queues', error);
            }
        }
    }

    // Update display elements
    updateDisplay() {
        document.getElementById('currentQueue').textContent = this.currentQueue;
        document.getElementById('totalQueues').textContent = this.totalQueues;
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
            timestamp: new Date().toISOString(),
            url: window.location.origin + '/web_QQ/queue-display.html'
        };
        
        // Generate QR code
        QRCode.toCanvas(qrCodeDiv, JSON.stringify(qrData), {
            width: 256,
            height: 256,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        }, (error) => {
            if (error) {
                console.error('QR Code generation failed:', error);
                this.showNotification('Failed to generate QR code', 'error');
            } else {
                qrSection.style.display = 'block';
            }
        });
    }

    // Hide QR section
    hideQRSection() {
        document.getElementById('qrSection').style.display = 'none';
    }

    // Print QR code
    printQRCode() {
        const printWindow = window.open('', '_blank');
        const qrSection = document.getElementById('qrSection');
        const currentDate = new Date().toLocaleDateString();
        const currentTime = new Date().toLocaleTimeString();
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Queue QR Code - ${this.currentQueue}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        text-align: center;
                        padding: 20px;
                    }
                    .print-header {
                        margin-bottom: 20px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                    }
                    .queue-info {
                        font-size: 18px;
                        margin: 10px 0;
                    }
                    .qr-container {
                        margin: 20px 0;
                    }
                    .instructions {
                        margin-top: 20px;
                        font-size: 14px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>Queue Management System</h1>
                    <p>Date: ${currentDate} | Time: ${currentTime}</p>
                </div>
                <div class="queue-info">
                    <h2>Queue Number: ${this.currentQueue}</h2>
                </div>
                <div class="qr-container">
                    ${qrSection.innerHTML}
                </div>
                <div class="instructions">
                    <p>Scan this QR code to view your queue status</p>
                    <p>Keep this slip until your number is called</p>
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