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

        this.server.listen(this.port, () => {
            console.log(`🚀 Queue Management Server running on http://localhost:${this.port}`);
            console.log('📁 Serving files from current directory');
            console.log('💾 Auth file:', this.authFile);
            console.log('📂 Backup directory:', this.backupDir);
        });
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
}

// Start the server
const server = new QueueServer();
server.start().catch(console.error);