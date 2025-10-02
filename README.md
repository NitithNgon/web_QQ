# Queue Management System

A web-based queue management system with JSON database persistence that allows distributors to generate queue numbers and provides QR codes for patients to track their queue status. Features automatic data backup and recovery to prevent data loss.

## 🚀 New Database Features

### JSON Database System
- **Automatic Backup**: Creates backup files every 30 seconds
- **Data Recovery**: Automatically loads data when server restarts
- **Export/Import**: Manual database export and import functionality
- **No Data Loss**: Multiple fallback mechanisms ensure data is never lost

### Server Mode (Recommended)
- **Node.js Server**: Run `node server.js` or `start-server.bat` for full functionality
- **API Endpoints**: RESTful API for database operations
- **File Operations**: Automatic file saving and loading
- **Backup Management**: Automatic cleanup of old backup files

### Browser Mode (Fallback)
- **Local Storage**: Falls back to browser storage if server is unavailable
- **Manual Export**: Download database as JSON file
- **Import Support**: Upload and restore from JSON backup files

## Features

### Distributor Queue Page (`distributor.html`)
- **Next Queue Button**: Generates the next queue number and creates a QR code
- **Reset Button**: Clears all queue data and resets counters to zero
- **QR Code Generation**: Automatically generates a QR code for each new queue
- **Print Function**: Allows printing of QR codes for patients
- **Real-time Updates**: Shows current queue number and total queues generated

### Queue Display Page (`queue-display.html`)
- **Real-time Queue Display**: Shows the current queue number being served
- **Queue Statistics**: Displays total queues, served queues, and remaining queues
- **Auto-refresh**: Automatically updates every 5 seconds
- **QR Code Integration**: When accessed via QR code, shows patient-specific information
- **Status Indicators**: Visual indicators for queue status

## How to Use

### For Distributors:
1. Open `distributor.html` in a web browser
2. Click "Next Queue" to generate a new queue number
3. A QR code will be generated automatically
4. Click "Print QR Code" to print the QR code for the patient
5. Give the printed QR code to the patient
6. Use "Reset All Queues" to clear all queue data when needed

### For Patients:
1. Scan the QR code provided by the distributor
2. This will open the queue display page
3. View your queue number and how many people are ahead of you
4. The page will automatically refresh to show current status

### For Queue Display (Public Screen):
1. Open `queue-display.html` on a public display screen
2. The page will show the current queue being served
3. Patients can also access this page directly to check overall queue status

## Files Structure

```
web_QQ/
├── index.html          # Home page with navigation
├── distributor.html    # Distributor queue management page
├── queue-display.html  # Queue display for patients
├── styles.css          # Styling for all pages
├── distributor.js      # JavaScript for distributor functionality
├── queue-display.js    # JavaScript for queue display functionality
└── README.md          # This file
```

## Technical Features

- **Dual Storage**: Falls back to localStorage if server is unavailable  
- **Auto-Backup System**: Creates timestamped backup files automatically
- **Data Recovery**: Loads previous session data on startup
- **QR Code Generation**: Uses QRCode.js library for generating QR codes
- **Responsive Design**: Works on desktop and mobile devices
- **Print Support**: Optimized printing for QR codes
- **Real-time Updates**: Automatic synchronization between distributor and display pages
- **API Endpoints**: RESTful API for all database operations
- **Export/Import**: Manual database backup and restore functionality
- **Statistics Tracking**: Daily queue statistics and analytics

## Dependencies

- QRCode.js (loaded via CDN): For generating QR codes
- Modern web browser with JavaScript enabled
- Local storage support

## Setup Instructions

### Option 1: With Server (Recommended for Data Persistence)
1. Make sure Node.js is installed on your system
2. Download all files to a folder
3. Open command prompt in the folder
4. Run: `node server.js` or double-click `start-server.bat`
5. Open `http://localhost:3000` in your web browser
6. Enjoy full database functionality with automatic backups

### Option 2: Static Files (Browser Only)
1. Download all files to a folder
2. Open `index.html` directly in a web browser
3. System will use localStorage with manual export/import
4. Limited functionality but still works offline

## Database Management

### Automatic Features
- **Auto-Save**: Every queue operation is automatically saved
- **Auto-Backup**: Creates backup every 30 seconds
- **Data Recovery**: Loads previous data on server restart
- **Backup Cleanup**: Keeps only the latest 10 backup files

### Manual Operations
- **Export Database**: Download complete database as JSON
- **Import Database**: Upload and restore from JSON backup
- **View Status**: Check database size, last backup time, and statistics
- **Reset with Backup**: Reset queues but keep backup file

## File Structure

```
web_QQ/
├── index.html              # Home page with navigation
├── distributor.html        # Distributor queue management page  
├── queue-display.html      # Queue display for patients
├── styles.css              # Styling for all pages
├── distributor.js          # Distributor functionality
├── queue-display.js        # Queue display functionality
├── database-manager.js     # Database operations manager
├── server.js              # Node.js server for database persistence
├── package.json           # Node.js project configuration
├── start-server.bat       # Windows batch file to start server
├── backups/               # Automatic backup files (auto-created)
└── README.md             # This file
```

## Browser Compatibility

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Any modern browser with ES6 support

## Notes

- Queue data is stored locally in the browser
- Clearing browser data will reset all queues
- For production use, consider implementing a backend database
- Print functionality requires browser print permissions
- QR codes contain queue information and timestamp