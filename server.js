// Enhanced Node.js server for Queue Management System with Authentication

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

class QueueServer {
    constructor() {
        this.port = 3000;
        this.authFile = 'queue-auth.json';
        this.backupDir = 'queue-backups';
        this.server = http.createServer((req, res) => this.handleRequest(req, res));
        this.cleanupInterval = null;
    }

    // Add this missing method to read request body
    async getRequestBody(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                resolve(body);
            });
            req.on('error', err => {
                reject(err);
            });
        });
    }

    async start() {
        // Ensure backup directory exists
        try {
            await fs.mkdir(this.backupDir, { recursive: true });
            console.log('📁 Backup directory ready');
        } catch (error) {
            console.error('Failed to create backup directory:', error);
        }

        // Start the cleanup scheduler
        this.startCleanupScheduler();

        this.server.listen(this.port, () => {
            console.log(`🚀 Queue Management Server running on http://localhost:${this.port}`);
            console.log('📁 Serving files from current directory');
            console.log('💾 Auth file:', this.authFile);
            console.log('📂 Backup directory:', this.backupDir);
            console.log('🧹 Cleanup scheduler started - checking inactive queues daily');
        });
    }

    // Start the daily cleanup scheduler
    startCleanupScheduler() {
        // Run cleanup immediately on startup
        this.performCleanup();
        
        // Schedule cleanup to run every 24 hours (86400000 milliseconds)
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
        
        console.log('🕒 Daily cleanup scheduler initialized');
    }

    // Stop the cleanup scheduler (useful for graceful shutdown)
    stopCleanupScheduler() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('🛑 Cleanup scheduler stopped');
        }
    }

    // Perform the daily cleanup check
    async performCleanup() {
        try {
            console.log('🧹 Starting daily cleanup check...');
            const now = new Date();
            console.log(`🕒 Current time: ${now.toISOString()}`);
            
            // Check if auth file exists
            try {
                await fs.access(this.authFile);
            } catch {
                console.log('📄 No auth file found, nothing to cleanup');
                return;
            }
            
            // Read auth data
            const authFileContent = await fs.readFile(this.authFile, 'utf8');
            const authData = JSON.parse(authFileContent);
            
            if (!authData.queues || Object.keys(authData.queues).length === 0) {
                console.log('📄 No queues found in auth file');
                return;
            }
            
            const queueNames = Object.keys(authData.queues);
            console.log(`🔍 Found ${queueNames.length} queues to check:`, queueNames);
            
            let deletedQueues = [];
            let activeQueues = [];
            
            // Check each queue for inactivity
            for (const queueName of queueNames) {
                const queueData = authData.queues[queueName];
                const lastAccessed = new Date(queueData.lastAccessed);
                const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);
                
                console.log(`📊 Queue "${queueName}": Last accessed ${daysSinceAccess.toFixed(2)} days ago`);
                
                if (daysSinceAccess > 1) {
                    console.log(`🗑️ Queue "${queueName}" is inactive (${daysSinceAccess.toFixed(2)} days), marking for deletion`);
                    deletedQueues.push(queueName);
                } else {
                    console.log(`✅ Queue "${queueName}" is active (${daysSinceAccess.toFixed(2)} days)`);
                    activeQueues.push(queueName);
                }
            }
            
            // Delete inactive queues
            if (deletedQueues.length > 0) {
                console.log(`🗑️ Deleting ${deletedQueues.length} inactive queues:`, deletedQueues);
                
                for (const queueName of deletedQueues) {
                    await this.deleteInactiveQueue(queueName);
                }
                
                console.log(`✅ Cleanup completed: ${deletedQueues.length} queues deleted, ${activeQueues.length} queues remain active`);
            } else {
                console.log(`✅ Cleanup completed: All ${activeQueues.length} queues are active, no deletion needed`);
            }
            
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
        }
    }

    // Delete an inactive queue (similar to deleteCurrentQueue in distributor.js)
    async deleteInactiveQueue(queueName) {
        try {
            console.log(`🗑️ Starting deletion process for inactive queue: "${queueName}"`);
            
            // Delete backup file
            await this.deleteQueueBackupFileInternal(queueName);
            
            // Remove queue from auth file
            await this.removeQueueFromAuthFile(queueName);
            
            console.log(`✅ Successfully deleted inactive queue: "${queueName}"`);
        } catch (error) {
            console.error(`❌ Failed to delete inactive queue "${queueName}":`, error);
        }
    }

    // Internal method to delete queue backup file (server-side only)
    async deleteQueueBackupFileInternal(queueName) {
        try {
            const filename = `queue-backup-${queueName}.json`;
            const filepath = path.join(this.backupDir, filename);
            
            console.log(`🗑️ Attempting to delete backup file: ${filepath}`);
            
            try {
                await fs.access(filepath);
                await fs.unlink(filepath);
                console.log(`✅ Backup file deleted: ${filename}`);
            } catch {
                console.log(`📄 Backup file not found (already deleted): ${filename}`);
            }
        } catch (error) {
            console.error(`❌ Error deleting backup file for ${queueName}:`, error);
        }
    }

    // Internal method to remove queue from auth file (server-side only)
    async removeQueueFromAuthFile(queueName) {
        try {
            console.log(`🗑️ Removing queue "${queueName}" from auth file`);
            
            // Read current auth data
            const authFileContent = await fs.readFile(this.authFile, 'utf8');
            const authData = JSON.parse(authFileContent);
            
            // Remove the specific queue
            if (authData.queues && authData.queues[queueName]) {
                delete authData.queues[queueName];
                authData.lastUpdated = new Date().toISOString();
                
                // If no queues left, delete the entire file
                if (Object.keys(authData.queues).length === 0) {
                    console.log('🗑️ No queues remaining, deleting entire auth file');
                    await fs.unlink(this.authFile);
                    console.log('✅ Auth file deleted (no queues remaining)');
                } else {
                    // Write updated auth data back to file
                    await fs.writeFile(this.authFile, JSON.stringify(authData, null, 2));
                    console.log(`✅ Queue "${queueName}" removed from auth file`);
                }
            } else {
                console.log(`📄 Queue "${queueName}" not found in auth file`);
            }
        } catch (error) {
            console.error(`❌ Error removing queue "${queueName}" from auth file:`, error);
        }
    }

    // Add method for manual cleanup trigger (for testing)
    async handleManualCleanup(req, res) {
        try {
            console.log('🧪 Manual cleanup triggered');
            await this.performCleanup();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Manual cleanup completed' }));
        } catch (error) {
            console.error('❌ Manual cleanup failed:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Manual cleanup failed: ' + error.message }));
        }
    }

    // Add method to get cleanup status
    async handleCleanupStatus(req, res) {
        try {
            const status = {
                schedulerActive: this.cleanupInterval !== null,
                lastCheck: new Date().toISOString(),
                nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                totalQueues: 0,
                activeQueues: 0,
                inactiveQueues: 0
            };

            // Get current queue statistics
            try {
                const authFileContent = await fs.readFile(this.authFile, 'utf8');
                const authData = JSON.parse(authFileContent);
                
                if (authData.queues) {
                    const now = new Date();
                    status.totalQueues = Object.keys(authData.queues).length;
                    
                    for (const [queueName, queueData] of Object.entries(authData.queues)) {
                        const lastAccessed = new Date(queueData.lastAccessed);
                        const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);
                        
                        if (daysSinceAccess > 1) {
                            status.inactiveQueues++;
                        } else {
                            status.activeQueues++;
                        }
                    }
                }
            } catch {
                // Auth file doesn't exist or is invalid
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status, null, 2));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to get cleanup status: ' + error.message }));
        }
    }

    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const path = parsedUrl.pathname;
        const method = req.method;

        // Add detailed logging
        console.log(`📡 ${method} ${path}`);

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        try {
            // API endpoints - add more specific logging
            if (path === '/api/save-auth' && method === 'POST') {
                console.log('🔄 Handling save auth');
                await this.handleSaveAuth(req, res);
            }
            else if (path === '/api/delete-auth' && method === 'DELETE') {
                console.log('🗑️ Handling delete entire auth file');
                await this.handleDeleteAuth(req, res);
            }
            else if (path === '/api/delete-queue-auth' && method === 'DELETE') {
                console.log('🗑️ Handling delete specific queue from auth');
                await this.handleDeleteQueueAuth(req, res);
            }
            else if (path === '/api/save-queue-backup' && method === 'POST') {
                console.log('🔄 Handling save queue backup');
                await this.handleSaveQueueBackup(req, res);
            }
            else if (path.startsWith('/api/get-queue-backup/') && method === 'GET') {
                const queueName = decodeURIComponent(path.split('/').pop());
                console.log('📥 Handling get queue backup for:', queueName);
                await this.handleGetQueueBackup(res, queueName);
            }
            else if (path.startsWith('/api/delete-queue-backup/') && method === 'DELETE') {
                const queueName = decodeURIComponent(path.split('/').pop());
                console.log('🗑️ Handling delete queue backup for:', queueName);
                await this.handleDeleteQueueBackup(res, queueName);
            }
            // New cleanup endpoints
            else if (path === '/api/manual-cleanup' && method === 'POST') {
                console.log('🧪 Handling manual cleanup');
                await this.handleManualCleanup(req, res);
            }
            else if (path === '/api/cleanup-status' && method === 'GET') {
                console.log('📊 Handling cleanup status');
                await this.handleCleanupStatus(req, res);
            }
            // Serve auth file directly
            else if (path === '/queue-auth.json') {
                console.log('📄 Serving auth file');
                await this.serveAuthFile(res);
            }
            // Serve static files
            else {
                console.log('📁 Serving static file:', path);
                await this.serveStaticFile(req, res, path);
            }
        } catch (error) {
            console.error('❌ Request handling error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error: ' + error.message }));
        }
    }

    // Handle saving authentication data
    async handleSaveAuth(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const authData = JSON.parse(body);
            
            console.log('💾 Saving auth data:', Object.keys(authData.queues || {}));
            
            await fs.writeFile(this.authFile, JSON.stringify(authData, null, 2));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            console.log('✅ Auth data saved successfully');
        } catch (error) {
            console.error('❌ Failed to save auth data:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    // Delete specific queue from auth file
    async handleDeleteQueueAuth(req, res) {
        try {
            console.log('🔍 handleDeleteQueueAuth called');
            
            // Get the queue name from request body
            const body = await this.getRequestBody(req);
            console.log('📝 Request body:', body);
            
            const { queueName } = JSON.parse(body);
            console.log(`🗑️ Attempting to remove queue "${queueName}" from auth file`);
            
            // Check if auth file exists
            try {
                await fs.access(this.authFile);
                console.log('📄 Auth file exists');
            } catch {
                console.log('📄 Auth file does not exist');
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Auth file not found' }));
                return;
            }
            
            // Read current auth data
            console.log('📖 Reading auth file...');
            const authFileContent = await fs.readFile(this.authFile, 'utf8');
            console.log('📖 Auth file content:', authFileContent);
            
            const authData = JSON.parse(authFileContent);
            console.log('📖 Parsed auth data:', JSON.stringify(authData, null, 2));
            
            // Check if queue exists in auth data
            if (!authData.queues || !authData.queues[queueName]) {
                console.log(`📄 Queue "${queueName}" not found in auth file`);
                console.log('📄 Available queues:', Object.keys(authData.queues || {}));
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Queue "${queueName}" not found in auth file` }));
                return;
            }
            
            // Remove the specific queue
            console.log(`🗑️ Removing queue "${queueName}" from auth data`);
            delete authData.queues[queueName];
            authData.lastUpdated = new Date().toISOString();
            
            console.log('📝 Updated auth data:', JSON.stringify(authData, null, 2));
            console.log('📝 Remaining queues:', Object.keys(authData.queues));
            
            // If no queues left, delete the entire file
            if (Object.keys(authData.queues).length === 0) {
                console.log('🗑️ No queues remaining, deleting entire auth file');
                await fs.unlink(this.authFile);
                console.log('✅ Entire auth file deleted');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Queue removed and auth file deleted (no queues remaining)' }));
            } else {
                // Write updated auth data back to file
                console.log('💾 Writing updated auth data to file...');
                const updatedContent = JSON.stringify(authData, null, 2);
                console.log('💾 Content to write:', updatedContent);
                
                await fs.writeFile(this.authFile, updatedContent);
                console.log('✅ Auth file updated successfully');
                
                // Verify the file was written correctly
                const verifyContent = await fs.readFile(this.authFile, 'utf8');
                console.log('✅ Verification - file now contains:', verifyContent);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: `Queue "${queueName}" removed from auth file` }));
            }
            
        } catch (error) {
            console.error('❌ Failed to remove queue from auth file:', error);
            console.error('❌ Error stack:', error.stack);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to remove queue from auth file: ' + error.message }));
        }
    }

    // Delete entire authentication file
    async handleDeleteAuth(req, res) {
        try {
            console.log('🗑️ Attempting to delete entire auth file:', this.authFile);
            
            // Check if file exists first
            try {
                await fs.access(this.authFile);
                console.log('📄 Auth file exists, proceeding to delete');
            } catch {
                console.log('📄 Auth file does not exist');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Auth file does not exist (already deleted)' }));
                return;
            }
            
            // Delete the file
            await fs.unlink(this.authFile);
            console.log('✅ Entire auth file successfully deleted');
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Entire auth file deleted successfully' }));
            
        } catch (error) {
            console.error('❌ Failed to delete auth file:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to delete auth file: ' + error.message }));
        }
    }

    // Handle saving queue backup
    async handleSaveQueueBackup(req, res) {
        try {
            const body = await this.getRequestBody(req);
            const backupData = JSON.parse(body);
            
            const filename = `queue-backup-${backupData.queueName}.json`;
            const filepath = path.join(this.backupDir, filename);
            
            await fs.writeFile(filepath, JSON.stringify(backupData, null, 2));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            console.log(`✅ Queue backup saved: ${filename}`);
        } catch (error) {
            console.error('❌ Failed to save queue backup:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }

    // Handle getting queue backup
    async handleGetQueueBackup(res, queueName) {
        try {
            const filename = `queue-backup-${queueName}.json`;
            const filepath = path.join(this.backupDir, filename);
            
            const data = await fs.readFile(filepath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
            console.log(`✅ Queue backup served: ${filename}`);
        } catch (error) {
            console.log(`📄 Queue backup not found: ${queueName}`);
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Queue backup not found' }));
        }
    }

    // Delete queue backup file
    async handleDeleteQueueBackup(res, queueName) {
        try {
            const filename = `queue-backup-${queueName}.json`;
            const filepath = path.join(this.backupDir, filename);
            
            console.log('🗑️ Attempting to delete backup file:', filepath);
            
            // Check if file exists first
            try {
                await fs.access(filepath);
                console.log('📄 Backup file exists, proceeding to delete');
            } catch {
                console.log('📄 Backup file does not exist');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: `Backup file for ${queueName} does not exist (already deleted)` }));
                return;
            }
            
            // Delete the file
            await fs.unlink(filepath);
            console.log('✅ Backup file successfully deleted');
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: `Backup file for ${queueName} deleted successfully` }));
            
        } catch (error) {
            console.error(`❌ Failed to delete backup for ${queueName}:`, error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to delete backup: ${error.message}` }));
        }
    }

    // Serve authentication file
    async serveAuthFile(res) {
        try {
            const data = await fs.readFile(this.authFile, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Auth file not found' }));
        }
    }

    // Serve static files
    async serveStaticFile(req, res, pathname) {
        const filePath = pathname === '/' ? './index.html' : `.${pathname}`;
        
        try {
            const data = await fs.readFile(filePath);
            const ext = path.extname(filePath);
            const contentType = this.getContentType(ext);
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
        }
    }

    // Get content type based on file extension
    getContentType(ext) {
        const types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon'
        };
        return types[ext] || 'text/plain';
    }

    // Graceful shutdown
    async shutdown() {
        console.log('🛑 Server shutting down...');
        this.stopCleanupScheduler();
        
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('✅ Server closed gracefully');
                resolve();
            });
        });
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    if (global.queueServer) {
        await global.queueServer.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    if (global.queueServer) {
        await global.queueServer.shutdown();
    }
    process.exit(0);
});

// Start the server
const server = new QueueServer();
global.queueServer = server;
server.start().catch(console.error);