// Queue management system for distributor
class QueueManager {
    constructor() {
        this.currentQueue = 0;
        this.totalQueues = 0;
        this.callingQueue = 0;
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
            this.callingQueue = status.callingQueue
            if (this.currentQueue > 0) {
                this.generateQRCode();
            }
        }
    }

    // Initialize event listeners
    initializeEventListeners() {
        document.getElementById('newQueueBtn').addEventListener('click', () => {
            this.generateNewQueue();
        });

        document.getElementById('callQueueBtn').addEventListener('click', () => {
            this.callNextQueue();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetAllQueues();
        });

        document.getElementById('printBtn').addEventListener('click', () => {
            this.printQRCode();
        });
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
                console.log(`Queue ${newQueueNumber} saved to backup`);
                
                // Reload data from backup to ensure sync
                this.loadQueueData();
            } else {
                // Fallback if no backup system
                this.currentQueue = newQueueNumber;
                this.totalQueues++;
            }
            
            this.updateDisplay();
            // this.generateQRCode();
            
            // Show success message
            this.showNotification(`Queue ${this.currentQueue} generated and backed up!`, 'success');
        } catch (error) {
            console.error('Failed to generate queue:', error);
            this.showNotification('Failed to generate queue', 'error');
        } finally {
            // Re-enable button
            setTimeout(() => {
                newQueueBtn.disabled = false;
                newQueueBtn.textContent = 'New Queue';
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
        if (confirm('Are you sure you want to reset all queues? This action cannot be undone.')) {
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
        document.getElementById('callingQueue').textContent = this.callingQueue;
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
            url: window.location.origin + '/queue-display.html'
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
        const qrSection = document.getElementById('qrSection');
        const qrCodeDiv = document.getElementById('qrcode');
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
                    <p>Date: ${currentDate} | Time: ${currentTime}</p>
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