// Simple Node.js server for Queue Management System
// This server provides API endpoints for database operations

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

class QueueServer {
    constructor(port = 3000) {
        this.port = port;
        this.backupFile = path.join(__dirname, 'queue-backup.json');
        this.init();
    }

    async init() {
        // Initialize backup file if it doesn't exist
        try {
            await fs.access(this.backupFile);
        } catch {
            await this.createInitialBackup();
        }

        this.startServer();
    }

    async createInitialBackup() {
        const initialData = {
            currentQueue: 0,
            totalQueues: 0,
            lastUpdated: new Date().toISOString(),
            queues: []
        };

        await fs.writeFile(this.backupFile, JSON.stringify(initialData, null, 2));
        console.log('Initial backup file created');
    }

    startServer() {
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        server.listen(this.port, () => {
            console.log(`Queue Management Server running on http://localhost:${this.port}`);
            console.log('Available endpoints:');
            console.log('  POST /api/save-backup      - Save backup file');
            console.log('  GET  /queue-backup.json    - Get backup file');
            console.log('  GET  /                     - Serve static files');
        });
    }

    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const path = parsedUrl.pathname;
        const method = req.method;

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
            // API endpoints
            if (path === '/api/save-backup' && method === 'POST') {
                await this.handleSaveBackup(req, res);
            }
            // Serve backup file directly
            else if (path === '/queue-backup.json') {
                await this.serveBackupFile(res);
            }
            // Serve static files
            else {
                await this.serveStaticFile(req, res, path);
            }
        } catch (error) {
            console.error('Request handling error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    async handleSaveBackup(req, res) {
        let body = '';
        req.on('data', chunk => body += chunk);
        await new Promise(resolve => req.on('end', resolve));

        try {
            await fs.writeFile(this.backupFile, body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Backup saved' }));
            console.log('Backup file updated');
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save backup' }));
        }
    }

    async serveBackupFile(res) {
        try {
            const data = await fs.readFile(this.backupFile, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Backup file not found' }));
        }
    }

    async serveStaticFile(req, res, urlPath) {
        let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath.slice(1));
        
        try {
            await fs.access(filePath);
        } catch {
            filePath = path.join(__dirname, 'index.html'); // Default to index.html
        }

        try {
            const data = await fs.readFile(filePath);
            const ext = path.extname(filePath);
            const contentType = this.getContentType(ext);
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        } catch (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
        }
    }

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
if (require.main === module) {
    const port = process.env.PORT || 3000;
    new QueueServer(port);
}

module.exports = QueueServer;