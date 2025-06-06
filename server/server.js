// server/server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises'); // Using promises version of fs
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5000;

// --- Configuration Paths ---
const ROOT_PROJECT_DIR = path.join(__dirname, '..'); // Go up one level from 'server' to 'web-proj-os'
const DATA_DIR = path.join(__dirname, 'data'); // server/data
const CVFS_ROOT_DIR = path.join(DATA_DIR, 'user_data'); // User data directory for files and apps
const USERS_FILE = path.join(DATA_DIR, 'users.json'); // server/data/users.json
const APPS_MANIFEST_FILE = path.join(DATA_DIR, 'apps_manifest.json'); // server/data/apps_manifest.json
const SETTINGS_DIR = path.join(DATA_DIR, 'settings'); // New: Directory for user-specific settings

// CRITICAL: This path points to your frontend's src/apps directory.
// This is where the actual React component files are located.
const FRONTEND_APPS_DIR = path.join(ROOT_PROJECT_DIR, 'frontend', 'src', 'apps');

// --- Predefined App Metadata ---
// This list describes the apps that are built into the frontend.
// Their React components are already present in frontend/src/apps.
// The backend's role is just to list them in apps_manifest.json.
const PREDEFINED_APPS = [
    { appId: 'hello-world-app', title: 'Hello World', componentName: 'HelloWorldApp', description: 'A simple greeting application.' },
    { appId: 'file-explorer-app', title: 'File Explorer', componentName: 'FileExplorer', description: 'Browse and manage your files.' },
    { appId: 'text-editor-app', title: 'Text Editor', componentName: 'TextEditor', description: 'Edit text files.' },
    { appId: 'terminal-app', title: 'Terminal', componentName: 'TerminalApp', description: 'Access the command line.' },
    { appId: 'calculator-app', title: 'Calculator', componentName: 'CalculatorApp', description: 'A basic calculator application.' },
    { appId: 'about-os-app', title: 'About CrusadeOS', componentName: 'AboutApp', description: 'Information about CrusadeOS.' },
    { appId: 'image-viewer-app', title: 'Image Viewer', componentName: 'ImageViewerApp', description: 'View image files.' },
    { appId: 'settings-app', title: 'Settings', componentName: 'SettingsApp', description: 'Configure OS settings.' },
];

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Helper Functions ---

// Ensures necessary data directories and files exist on server startup
async function ensureDataStructuresExist() {
    try {
        // Create data directories
        await fs.mkdir(CVFS_ROOT_DIR, { recursive: true });
        await fs.mkdir(FRONTEND_APPS_DIR, { recursive: true });
        await fs.mkdir(SETTINGS_DIR, { recursive: true }); // Create settings directory
        
        // Ensure core data files exist
        for (const file of [USERS_FILE, APPS_MANIFEST_FILE]) {
            try {
                await fs.access(file);
                console.log(`${path.basename(file)} exists: ${file}`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.writeFile(file, '[]', 'utf8');
                    console.log(`${path.basename(file)} created: ${file}`);
                } else {
                    console.error(`Error accessing or creating ${path.basename(file)}:`, error);
                    throw error;
                }
            }
        }
        
        // Populate default app metadata if apps_manifest.json is empty
        await populateDefaultAppsManifest();

    } catch (error) {
        console.error('CRITICAL ERROR: Failed to ensure data structures exist:', error.message);
        process.exit(1);
    }
}

// Function to populate apps_manifest.json with PREDEFINED_APPS metadata if empty
async function populateDefaultAppsManifest() {
    try {
        const installedApps = JSON.parse(await fs.readFile(APPS_MANIFEST_FILE, 'utf8'));

        if (installedApps.length === 0) {
            console.log('\n🚀 No apps found in manifest. Populating default application metadata...');

            const initialManifest = PREDEFINED_APPS.map(app => ({
                appId: app.appId,
                title: app.title,
                componentName: app.componentName,
                description: app.description || '',
                installedAt: new Date().toISOString(),
                cvfsPath: null, // These are built-in apps, no .pakapp path
                isCore: true, // Mark them as core apps, typically not uninstallable
            }));

            await fs.writeFile(APPS_MANIFEST_FILE, JSON.stringify(initialManifest, null, 2), 'utf8');
            console.log('✅ Default application metadata populated successfully.');
            console.log('   Default apps should now be visible in your frontend.');
        } else {
            console.log('Apps manifest already contains entries. Skipping default app metadata population.');
        }
    } catch (error) {
        console.error('Error during default app manifest population:', error.message);
        // Do not throw, as we want the server to start even if this specific step fails.
    }
}

// Security helper: Ensures path is within CVFS_ROOT_DIR
function getAbsolutePath(relativePath) {
    const absolutePath = path.join(CVFS_ROOT_DIR, path.normalize(relativePath));
    if (!absolutePath.startsWith(CVFS_ROOT_DIR)) {
        console.error(`Security violation attempt: Path traversal detected for "${relativePath}"`);
        throw new Error('Security Error: Attempted path traversal outside CVFS root.');
    }
    if (relativePath === '/') {
        return CVFS_ROOT_DIR; // Explicitly handle root path
    }
    return absolutePath;
}

// Enhanced session management
const sessions = new Map(); // Map<sessionId, { userId, lastActivity, expiresAt }>
const TOKEN_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

// Session cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now >= session.expiresAt) {
      sessions.delete(sessionId);
      console.log(`Session expired and cleaned up: ${sessionId}`);
    }
  }
}, 60000); // Check every minute

// Enhanced authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  const session = sessions.get(token);
  if (!session) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }

  // Check if session is expired
  if (Date.now() >= session.expiresAt) {
    sessions.delete(token);
    return res.status(403).json({ message: 'Token expired.' });
  }

  // Update last activity
  session.lastActivity = Date.now();
  session.expiresAt = Date.now() + TOKEN_EXPIRY_TIME;
  
  req.userId = session.userId;
  next();
};

// --- User Authentication Endpoints ---

app.post('/api/auth/signup', async (req, res) => {
    const { username, password } = req.body;
    console.log(`Signup attempt for username: ${username}`);
    if (!username || !password) {
        console.warn('Signup failed: Missing username or password.');
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
        if (users.some(u => u.username === username)) {
            console.warn(`Signup failed: Username "${username}" already taken.`);
            return res.status(409).json({ message: 'Username already taken.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: uuidv4(), username, password: hashedPassword };
        users.push(newUser);
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');

        console.log(`User "${username}" registered successfully.`);
        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error(`Signup error for "${username}":`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to register user.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    const user = users.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Create new session
    const token = uuidv4();
    sessions.set(token, {
      userId: user.id,
      lastActivity: Date.now(),
      expiresAt: Date.now() + TOKEN_EXPIRY_TIME
    });

    // Create user settings file if it doesn't exist
    const userSettingsPath = path.join(SETTINGS_DIR, `${user.id}.json`);
    try {
      await fs.access(userSettingsPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.writeFile(userSettingsPath, JSON.stringify({
          pinnedApps: [],
          desktopBackgroundColor: '#1a202c',
          desktopBackgroundImage: ''
        }, null, 2));
      }
    }

    res.json({
      token,
      userId: user.id,
      expiresIn: TOKEN_EXPIRY_TIME
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  sessions.delete(token);
  res.json({ message: 'Logged out successfully.' });
});

// Add token refresh endpoint
app.post('/api/auth/refresh', authenticateToken, (req, res) => {
  const oldToken = req.headers.authorization.split(' ')[1];
  const oldSession = sessions.get(oldToken);
  
  if (!oldSession) {
    return res.status(403).json({ message: 'Invalid session.' });
  }

  // Create new session
  const newToken = uuidv4();
  sessions.set(newToken, {
    userId: oldSession.userId,
    lastActivity: Date.now(),
    expiresAt: Date.now() + TOKEN_EXPIRY_TIME
  });

  // Remove old session
  sessions.delete(oldToken);

  res.json({
    newToken,
    expiresIn: TOKEN_EXPIRY_TIME
  });
});

// --- CVFS API Endpoints (Protected by Authentication) ---

app.get('/api/cvfs/list', authenticateToken, async (req, res) => {
    const cvfsPath = req.query.path || '/';
    try {
        const absolutePath = getAbsolutePath(cvfsPath);
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        // Use Promise.all to get sizes asynchronously
        const items = await Promise.all(entries.map(async entry => {
            let size = null;
            if (entry.isFile()) {
                try {
                    const stat = await fs.stat(path.join(absolutePath, entry.name));
                    size = stat.size;
                } catch {}
            }
            return {
                name: entry.name,
                type: entry.isDirectory() ? 'folder' : 'file',
                size
            };
        }));
        res.setHeader('Content-Type', 'application/json');
        res.json(items);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`CVFS list failed: Path "${cvfsPath}" not found for user ${req.userId}.`);
            return res.status(404).json({ message: 'Path not found.' });
        }
        console.error(`Error listing directory "${cvfsPath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to list directory contents.' });
    }
});

app.post('/api/cvfs/create', authenticateToken, async (req, res) => {
    const { path: parentPath, name, type } = req.body;
    console.log('DEBUG /api/cvfs/create body:', req.body);
    console.log(`CVFS create attempt for ${type} "${name}" in "${parentPath}" by user ${req.userId}.`);
    if (!parentPath || !name || !type) {
        console.warn('CVFS create failed: Missing path, name, or type.');
        return res.status(400).json({ message: 'Missing path, name, or type.' });
    }
    if (!['folder', 'file'].includes(type)) {
        console.warn(`CVFS create failed: Invalid item type "${type}".`);
        return res.status(400).json({ message: 'Invalid item type.' });
    }
    try {
        const absoluteParentPath = getAbsolutePath(parentPath);
        const newItemPath = path.join(absoluteParentPath, name);
        try { await fs.access(newItemPath); console.warn(`CVFS create failed: Item "${name}" already exists in "${parentPath}".`); return res.status(409).json({ message: `Item "${name}" already exists.` }); } catch (error) { if (error.code !== 'ENOENT') { throw error; } }

        // Ensure the parent directory exists
        try {
            await fs.mkdir(absoluteParentPath, { recursive: true });
        } catch (error) {
            console.error(`Error ensuring directory exists for path "${absoluteParentPath}":`, error.message);
            return res.status(500).json({ message: 'Failed to ensure directory exists.' });
        }

        // Handle permission errors gracefully
        try {
            if (type === 'folder') {
                await fs.mkdir(newItemPath);
            } else {
                await fs.writeFile(newItemPath, '');
            }
        } catch (error) {
            if (error.code === 'EPERM') {
                console.error(`Permission error creating ${type} "${name}" in "${parentPath}":`, error.message);
                return res.status(403).json({ message: 'Permission denied. Please check server permissions.' });
            }
            throw error;
        }

        console.log(`${type} "${name}" created successfully in "${parentPath}" by user ${req.userId}.`);
        res.status(201).json({ message: `${type} "${name}" created successfully.` });
    } catch (error) {
        console.error(`Error creating ${type} "${name}" in "${parentPath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: `Failed to create ${type}.` });
    }
});

app.get('/api/cvfs/file', authenticateToken, async (req, res) => {
    const { path: filePath } = req.query;
    console.log(`CVFS get file attempt for "${filePath}" by user ${req.userId}.`);
    if (!filePath) {
        console.warn('CVFS get file failed: Missing file path.');
        return res.status(400).json({ message: 'Missing file path.' });
    }
    try {
        const absoluteFilePath = getAbsolutePath(filePath);
        const stats = await fs.stat(absoluteFilePath);
        if (stats.isDirectory()) {
            console.warn(`CVFS get file failed: Cannot get content of a directory "${filePath}".`);
            return res.status(400).json({ message: 'Cannot get content of a directory.' });
        }
        
        const ext = path.extname(filePath).toLowerCase();
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
        const textExtensions = ['.txt', '.js', '.json', '.css', '.html', '.md', '.xml', '.log', '.sh', '.py'];

        if (imageExtensions.includes(ext)) {
            res.sendFile(absoluteFilePath);
        } else if (textExtensions.includes(ext)) {
            const content = await fs.readFile(absoluteFilePath, 'utf8');
            res.json({ content });
        } else {
            // For other file types, serve as binary or disallow
            console.warn(`CVFS get file: Attempting to serve unsupported file type "${ext}" for path "${filePath}".`);
            res.sendFile(absoluteFilePath, (err) => {
                if (err) {
                    console.error(`Error serving file "${filePath}" for user ${req.userId}:`, err.message, err.stack);
                    res.status(500).json({ message: 'Failed to serve file.' });
                }
            });
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`CVFS get file failed: File "${filePath}" not found for user ${req.userId}.`);
            return res.status(404).json({ message: 'File not found.' });
        }
        console.error(`Error reading file content "${filePath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to read file content.' });
    }
});

app.put('/api/cvfs/file', authenticateToken, async (req, res) => {
    const { path: filePath, content } = req.body;
    console.log(`CVFS update file attempt for "${filePath}" by user ${req.userId}.`);
    if (!filePath) {
        console.warn('CVFS update file failed: Missing file path.');
        return res.status(400).json({ message: 'Missing file path.' });
    }
    try {
        const absoluteFilePath = getAbsolutePath(filePath);
        const stats = await fs.stat(absoluteFilePath);
        if (stats.isDirectory()) {
            console.warn(`CVFS update file failed: Cannot write to a directory "${filePath}".`);
            return res.status(400).json({ message: 'Cannot write to a directory.' });
        }
        await fs.writeFile(absoluteFilePath, content, 'utf8');
        console.log(`File "${filePath}" content updated successfully by user ${req.userId}.`);
        res.json({ message: 'File content updated successfully.' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`CVFS update file failed: File "${filePath}" not found for user ${req.userId}.`);
            return res.status(404).json({ message: 'File not found.' });
        }
        console.error(`Error writing file content to "${filePath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to update file content.' });
    }
});

app.delete('/api/cvfs/delete', authenticateToken, async (req, res) => {
    const { path: itemPath } = req.body;
    console.log(`CVFS delete attempt for "${itemPath}" by user ${req.userId}.`);
    if (!itemPath) {
        console.warn('CVFS delete failed: Missing item path.');
        return res.status(400).json({ message: 'Missing item path.' });
    }
    try {
        const absoluteItemPath = getAbsolutePath(itemPath);
        const stats = await fs.stat(absoluteItemPath);
        if (stats.isDirectory()) {
            const contents = await fs.readdir(absoluteItemPath);
            if (contents.length > 0) {
                console.warn(`CVFS delete failed: Cannot delete non-empty folder "${itemPath}".`);
                return res.status(400).json({ message: 'Cannot delete non-empty folder. Use /api/cvfs/delete-recursive for that.' });
            }
            await fs.rmdir(absoluteItemPath);
        } else { await fs.unlink(absoluteItemPath); }
        console.log(`Item "${itemPath}" deleted successfully by user ${req.userId}.`);
        res.json({ message: 'Item deleted successfully.' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`CVFS delete failed: Item "${itemPath}" not found for user ${req.userId}.`);
            return res.status(404).json({ message: 'Item not found.' });
        }
        console.error(`Error deleting item "${itemPath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to delete item.' });
    }
});

app.post('/api/cvfs/copy', authenticateToken, async (req, res) => {
    const { sourcePath, destinationPath } = req.body;
    console.log(`CVFS copy attempt from "${sourcePath}" to "${destinationPath}" by user ${req.userId}.`);
    if (!sourcePath || !destinationPath) {
        console.warn('CVFS copy failed: Missing source or destination path.');
        return res.status(400).json({ message: 'Source and destination paths are required.' });
    }
    try {
        const absSourcePath = getAbsolutePath(sourcePath);
        const absDestinationPath = getAbsolutePath(destinationPath);
        await fs.mkdir(path.dirname(absDestinationPath), { recursive: true });
        await fs.cp(absSourcePath, absDestinationPath, { recursive: true, force: false }); // force: false prevents overwriting
        console.log(`Copied '${sourcePath}' to '${destinationPath}' successfully by user ${req.userId}.`);
        res.status(200).json({ message: `Copied '${sourcePath}' to '${destinationPath}'.` });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`CVFS copy failed: Source path "${sourcePath}" not found for user ${req.userId}.`);
            return res.status(404).json({ message: 'Source path not found.' });
        }
        if (error.code === 'EEXIST') {
            console.warn(`CVFS copy failed: Destination path "${destinationPath}" already exists.`);
            return res.status(409).json({ message: 'Destination path already exists. Cannot overwrite.' });
        }
        console.error(`Error copying item from "${sourcePath}" to "${destinationPath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to copy item.' });
    }
});

app.post('/api/cvfs/move', authenticateToken, async (req, res) => {
    const { sourcePath, destinationPath } = req.body;
    console.log(`CVFS move attempt from "${sourcePath}" to "${destinationPath}" by user ${req.userId}.`);
    if (!sourcePath || !destinationPath) {
        console.warn('CVFS move failed: Missing source or destination path.');
        return res.status(400).json({ message: 'Source and destination paths are required.' });
    }
    try {
        const absSourcePath = getAbsolutePath(sourcePath);
        const absDestinationPath = getAbsolutePath(destinationPath);
        await fs.mkdir(path.dirname(absDestinationPath), { recursive: true });
        await fs.rename(absSourcePath, absDestinationPath); // rename also moves
        console.log(`Moved/Renamed '${sourcePath}' to '${destinationPath}' successfully by user ${req.userId}.`);
        res.status(200).json({ message: `Moved/Renamed '${sourcePath}' to '${destinationPath}'.` });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`CVFS move failed: Source path "${sourcePath}" not found for user ${req.userId}.`);
            return res.status(404).json({ message: 'Source path not found.' });
        }
        if (error.code === 'EEXIST') {
            console.warn(`CVFS move failed: Destination path "${destinationPath}" already exists.`);
            return res.status(409).json({ message: 'Destination path already exists.' });
        }
        console.error(`Error moving/renaming item from "${sourcePath}" to "${destinationPath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to move/rename item.' });
    }
});

app.delete('/api/cvfs/delete-recursive', authenticateToken, async (req, res) => {
    const { path: itemPath } = req.body;
    console.log(`CVFS recursive delete attempt for "${itemPath}" by user ${req.userId}.`);
    if (!itemPath) {
        console.warn('CVFS recursive delete failed: Missing item path.');
        return res.status(400).json({ message: 'Item path is required.' });
    }
    try {
        const absoluteItemPath = getAbsolutePath(itemPath);
        await fs.rm(absoluteItemPath, { recursive: true, force: true }); // Use fs.rm for recursive deletion
        console.log(`Item '${itemPath}' deleted recursively successfully by user ${req.userId}.`);
        res.status(200).json({ message: `Item '${itemPath}' deleted recursively.` });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`CVFS recursive delete failed: Item "${itemPath}" not found for user ${req.userId}.`);
            return res.status(404).json({ message: 'Item not found.' });
        }
        console.error(`Error deleting item recursively "${itemPath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to delete item recursively.' });
    }
});

app.get('/api/cvfs/metadata', authenticateToken, async (req, res) => {
    const { path: itemPath } = req.query;
    console.log(`CVFS get metadata attempt for "${itemPath}" by user ${req.userId}.`);
    if (!itemPath) {
        console.warn('CVFS get metadata failed: Missing item path.');
        return res.status(400).json({ message: 'Item path is required.' });
    }
    try {
        const absoluteItemPath = getAbsolutePath(itemPath);
        const stats = await fs.stat(absoluteItemPath);
        res.json({
            name: path.basename(itemPath),
            path: itemPath,
            type: stats.isDirectory() ? 'folder' : 'file',
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`CVFS get metadata failed: Item "${itemPath}" not found for user ${req.userId}.`);
            return res.status(404).json({ message: 'Item not found.' });
        }
        console.error(`Error getting item metadata "${itemPath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to get item metadata.' });
    }
});

app.get('/api/cvfs/serve-file', authenticateToken, async (req, res) => {
    const { path: filePath } = req.query;
    console.log(`CVFS serve file attempt for "${filePath}" by user ${req.userId}.`);
    if (!filePath) {
        console.warn('CVFS serve file failed: Missing file path.');
        return res.status(400).json({ message: 'File path is required.' });
    }
    try {
        const absoluteFilePath = getAbsolutePath(filePath);
        const stats = await fs.stat(absoluteFilePath);
        if (stats.isDirectory()) {
            console.warn(`CVFS serve file failed: Cannot serve directory content "${filePath}".`);
            return res.status(400).json({ message: 'Cannot serve directory content.' });
        }
        const ext = path.extname(absoluteFilePath).toLowerCase();
        let contentType = 'application/octet-stream';
        // Common mime types for basic serving
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.gif') contentType = 'image/gif';
        else if (ext === '.txt') contentType = 'text/plain';
        else if (ext === '.json') contentType = 'application/json';
        else if (ext === '.pdf') contentType = 'application/pdf';

        res.setHeader('Content-Type', contentType);
        res.sendFile(absoluteFilePath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`CVFS serve file failed: File "${filePath}" not found for user ${req.userId}.`);
            return res.status(404).json({ message: 'File not found.' });
        }
        console.error(`Error serving file "${filePath}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to serve file.' });
    }
});

// --- Apps Manifest & Management Endpoints ---

app.get('/api/apps/installed', authenticateToken, async (req, res) => {
    console.log(`Workspaceing installed apps for user ${req.userId}.`);
    try {
        const installedApps = JSON.parse(await fs.readFile(APPS_MANIFEST_FILE, 'utf8'));
        res.json(installedApps);
    } catch (error) {
        console.error(`Error getting installed apps for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to retrieve installed apps.' });
    }
});

app.post('/api/apps/install', authenticateToken, async (req, res) => {
    const { packagePath } = req.body;
    console.log(`App installation attempt for package at "${packagePath}" by user ${req.userId}.`);

    if (!packagePath) {
        console.warn('App installation failed: Package path is required.');
        return res.status(400).json({ message: 'Package path is required.' });
    }

    try {
        const packageManifestPath = path.join(packagePath, 'manifest.json');
        const manifest = JSON.parse(await fs.readFile(packageManifestPath, 'utf8'));

        const installedApps = JSON.parse(await fs.readFile(APPS_MANIFEST_FILE, 'utf8'));
        if (installedApps.some(app => app.appId === manifest.appId)) {
            console.warn(`App installation failed: App "${manifest.appId}" is already installed.`);
            return res.status(409).json({ message: `App "${manifest.appId}" is already installed.` });
        }

        installedApps.push({
            appId: manifest.appId,
            title: manifest.title,
            componentName: manifest.componentName,
            description: manifest.description || '',
            installedAt: new Date().toISOString(),
            vfsPath: packagePath,
            isCore: false
        });

        await fs.writeFile(APPS_MANIFEST_FILE, JSON.stringify(installedApps, null, 2), 'utf8');
        console.log(`App "${manifest.title}" installed successfully.`);
        res.status(201).json({ message: `App "${manifest.title}" installed successfully.` });
    } catch (error) {
        console.error(`Error installing app from package at "${packagePath}":`, error.message, error.stack);
        res.status(500).json({ message: 'Failed to install app.' });
    }
});

app.delete('/api/apps/uninstall', authenticateToken, async (req, res) => {
    const { appId } = req.body;
    console.log(`App uninstall attempt for appId "${appId}" by user ${req.userId}.`);

    if (!appId) {
        console.warn('App uninstall failed: App ID is required.');
        return res.status(400).json({ message: 'App ID is required for uninstallation.' });
    }

    try {
        let installedApps = JSON.parse(await fs.readFile(APPS_MANIFEST_FILE, 'utf8'));
        const appToUninstall = installedApps.find(app => app.appId === appId);

        if (!appToUninstall) {
            console.warn(`App uninstall failed: App "${appId}" not found in installed apps.`);
            return res.status(404).json({ message: `App "${appId}" not found in installed apps.` });
        }
        
        if (appToUninstall.isCore) {
            console.warn(`App uninstall denied: App "${appToUninstall.title}" is a core system app.`);
            return res.status(403).json({ message: `App "${appToUninstall.title}" is a core system app and cannot be uninstalled.` });
        }

        // If you had non-core apps that could be uninstalled, you'd add logic here:
        // installedApps = installedApps.filter(app => app.appId !== appId);
        // await fs.writeFile(APPS_MANIFEST_FILE, JSON.stringify(installedApps, null, 2), 'utf8');

        // For now, since all are core, this is a "failed" uninstall due to policy
        res.status(200).json({
            message: `App "${appToUninstall.title}" is a built-in core app and cannot be uninstalled in this system.`,
        });

    } catch (error) {
        console.error(`Error uninstalling app "${appId}" for user ${req.userId}:`, error.message, error.stack);
        res.status(500).json({ message: error.message || 'Failed to uninstall app.' });
    }
});


// --- Settings API Endpoints ---

app.get('/api/settings/load', authenticateToken, async (req, res) => {
    console.log(`Loading settings for user ${req.userId}.`);
    const userSettingsFile = path.join(SETTINGS_DIR, `${req.userId}.json`);
    const backupSettingsFile = `${userSettingsFile}.bak`;

    try {
        await fs.access(userSettingsFile);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Attempt to restore from backup
            try {
                await fs.copyFile(backupSettingsFile, userSettingsFile);
                console.log(`Restored settings for user ${req.userId} from backup.`);
            } catch (backupError) {
                if (backupError.code === 'ENOENT') {
                    // Create default settings if no backup exists
                    const defaultSettings = {
                        desktopBackgroundColor: '#1a202c',
                        desktopBackgroundImage: '',
                        pinnedApps: []
                    };
                    await fs.writeFile(userSettingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
                    return res.json(defaultSettings);
                }
                throw backupError;
            }
        } else {
            throw error;
        }
    }
    
    try {
        const settings = JSON.parse(await fs.readFile(userSettingsFile, 'utf8'));
        res.json(settings);
    } catch (error) {
        console.error(`Error loading settings for user ${req.userId}:`, error.message);
        res.status(500).json({ message: 'Failed to load settings.' });
    }
});

app.post('/api/settings/save', authenticateToken, async (req, res) => {
    const newSettings = req.body;
    if (process.env.NODE_ENV === 'development') {
        console.log(`Saving settings for user ${req.userId}.`);
    }
    const userSettingsFile = path.join(SETTINGS_DIR, `${req.userId}.json`);
    
    try {
        await fs.writeFile(userSettingsFile, JSON.stringify(newSettings, null, 2), 'utf8');
        console.log(`Settings saved successfully for user ${req.userId}.`);
        res.status(200).json({ message: 'Settings saved successfully.' });
    } catch (error) {
        console.error(`Error saving settings for user ${req.userId}:`, error.message);
        res.status(500).json({ message: 'Failed to save settings.' });
    }
});

// --- NEW: Frontend Error Logging Endpoint ---
// This endpoint allows your frontend to send its JavaScript errors to the backend for logging.
app.post('/api/log/frontend-error', (req, res) => {
    const { message, stack, url, lineNumber, columnNumber, componentStack } = req.body;
    console.error('\n--- FRONTEND ERROR REPORT ---');
    console.error('Message:', message || 'No message provided');
    console.error('URL:', url || 'N/A');
    console.error('Location:', `Line ${lineNumber || 'N/A'}, Column ${columnNumber || 'N/A'}`);
    console.error('Stack:', stack || 'No stack trace provided');
    console.error('Component Stack (if React error boundary):', componentStack || 'N/A');
    console.error('Timestamp:', new Date().toISOString());
    console.error('-----------------------------\n');
    res.status(200).json({ message: 'Frontend error logged successfully on backend.' });
});

// --- Centralized Error Handling Middleware ---
// This should be the last app.use() before app.listen().
// It catches any errors thrown in async routes or passed via next(err).
app.use((err, req, res, next) => {
    console.error('\n--- UNHANDLED SERVER ERROR ---');
    console.error('Request:', req.method, req.originalUrl);
    console.error('Error Message:', err.message);
    console.error('Error Stack:', err.stack);
    console.error('Timestamp:', new Date().toISOString());
    console.error('------------------------------\n');

    // Respond to the client (avoid sending full stack trace in production)
    if (res.headersSent) { // Check if headers have already been sent by another middleware
        return next(err); // Pass error to Express's default error handler
    }
    res.status(err.statusCode || 500).json({
        message: 'An unexpected server error occurred.',
        error: process.env.NODE_ENV === 'production' ? null : err.message // Send error message only in dev
    });
});

app.get('/api/health', (req,res) => {
    res.status(200).json({ message: 'CrusadeOS backend is healthy and running!.' });
})

// --- Start the Server ---
// Ensure data structures exist and then start the Express server
ensureDataStructuresExist().then(() => {
    app.listen(PORT, () => {
        console.log(`\nNode.js CVFS & Auth Server running on http://localhost:${PORT}`);
        console.log(`User data will be stored in: ${USERS_FILE}`);
        console.log(`CVFS data will be stored in: ${CVFS_ROOT_DIR}`);
        console.log(`Installed apps manifest: ${APPS_MANIFEST_FILE}`);
        console.log(`User settings: ${SETTINGS_DIR}`);
        console.log(`Frontend app components are expected in: ${FRONTEND_APPS_DIR}`);
        console.log('\n--- IMPORTANT ---');
        console.log('Default apps are populated into apps_manifest.json on first run of the backend.');
        console.log('You should not need to restart your frontend for default apps to appear after initial backend setup.');
        console.log('Temporary debug logs for login are active. REMOVE THEM IN PRODUCTION!');
    });
}).catch(err => {
    console.error('Server failed to initialize due to a critical error:', err.message);
    process.exit(1); // Exit if initialization fails
});