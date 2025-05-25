// server/server.js

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5000;

// --- Configuration Paths ---
const DATA_DIR = path.join(__dirname, 'data');
const VFS_ROOT_DIR = path.join(DATA_DIR, 'vfs_data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const APPS_MANIFEST_FILE = path.join(DATA_DIR, 'apps_manifest.json'); // New: Stores installed app metadata

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Predefined Available Apps (Frontend Components) ---
// This list maps 'appId' (from .pakapp) to 'componentName' (that frontend knows how to render)
const PREDEFINED_APPS = [
    { appId: 'hello-world-app', title: 'Hello World', componentName: 'HelloWorldApp', description: 'A simple greeting application.' },
    { appId: 'file-explorer-app', title: 'File Explorer', componentName: 'FileExplorer', description: 'Browse and manage your files.' },
    { appId: 'text-editor-app', title: 'Text Editor', componentName: 'TextEditor', description: 'Edit text files.' },
    { appId: 'terminal-app', title: 'Terminal', componentName: 'TerminalApp', description: 'Access the command line.' },
    // Add more predefined apps here as your frontend develops them
];

// --- Helper Functions ---

// Ensures necessary data directories and files exist on server startup
async function ensureDataStructuresExist() {
    try {
        await fs.mkdir(VFS_ROOT_DIR, { recursive: true });
        console.log(`VFS root directory created or already exists: ${VFS_ROOT_DIR}`);

        for (const file of [USERS_FILE, APPS_MANIFEST_FILE]) {
            try {
                await fs.access(file);
                console.log(`${path.basename(file)} exists: ${file}`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.writeFile(file, '[]', 'utf8'); // Create empty array for JSON files
                    console.log(`${path.basename(file)} created: ${file}`);
                } else {
                    throw error;
                }
            }
        }
    } catch (error) {
        console.error('CRITICAL ERROR: Failed to ensure data structures exist:', error);
        process.exit(1);
    }
}

// Security helper: Ensures path is within VFS_ROOT_DIR
function getAbsolutePath(relativePath) {
    // Normalize path to prevent '..' traversal attempts
    const absolutePath = path.join(VFS_ROOT_DIR, path.normalize(relativePath));
    // Ensure the resolved path is actually within the VFS_ROOT_DIR
    if (!absolutePath.startsWith(VFS_ROOT_DIR)) {
        throw new Error('Security Error: Attempted path traversal outside VFS root.');
    }
    return absolutePath;
}

// Simple in-memory "session" store for this example (for production, use a more robust solution like Redis)
const activeSessions = new Map(); // Map<sessionId, userId>

// Middleware for authentication (simple token check)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects 'Bearer TOKEN'

    if (!token) {
        return res.status(401).json({ message: 'Authentication token required.' });
    }

    if (!activeSessions.has(token)) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    req.userId = activeSessions.get(token); // Attach userId to request
    next();
};

// --- User Authentication Endpoints ---

app.post('/api/auth/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const users = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
        if (users.some(u => u.username === username)) {
            return res.status(409).json({ message: 'Username already taken.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: uuidv4(), username, password: hashedPassword };
        users.push(newUser);
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');

        res.status(201).json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error('Signup error:', error);
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

        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        const sessionId = uuidv4();
        activeSessions.set(sessionId, user.id);
        res.json({ message: 'Login successful!', token: sessionId, userId: user.id });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Failed to log in.' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token && activeSessions.has(token)) {
        activeSessions.delete(token);
        return res.json({ message: 'Logged out successfully.' });
    }
    res.status(400).json({ message: 'No active session found.' });
});

// --- VFS API Endpoints (Protected by Authentication) ---
// (These are the same as before, no changes needed for existing ones)

// 1. Get Directory Contents (List items)
app.get('/api/vfs/list', authenticateToken, async (req, res) => {
    const vfsPath = req.query.path || '/';

    try {
        const absolutePath = getAbsolutePath(vfsPath);
        const entries = await fs.readdir(absolutePath, { withFileTypes: true });

        const items = entries.map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'folder' : 'file',
        }));
        res.json(items);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Path not found.' });
        }
        console.error('Error listing directory:', error);
        res.status(500).json({ message: 'Failed to list directory contents.' });
    }
});

// 2. Create Item (Folder or File)
app.post('/api/vfs/create', authenticateToken, async (req, res) => {
    const { path: parentPath, name, type } = req.body;

    if (!parentPath || !name || !type) {
        return res.status(400).json({ message: 'Missing path, name, or type.' });
    }
    if (!['folder', 'file'].includes(type)) {
        return res.status(400).json({ message: 'Invalid item type.' });
    }

    try {
        const absoluteParentPath = getAbsolutePath(parentPath);
        const newItemPath = path.join(absoluteParentPath, name);

        try {
            await fs.access(newItemPath);
            return res.status(409).json({ message: `Item "${name}" already exists.` });
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        if (type === 'folder') {
            await fs.mkdir(newItemPath);
        } else { // type === 'file'
            await fs.writeFile(newItemPath, ''); // Create an empty file
        }
        res.status(201).json({ message: `<span class="math-inline">\{type\} "</span>{name}" created successfully.` });
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({ message: `Failed to create ${type}.` });
    }
});

// 3. Get File Content
app.get('/api/vfs/file', authenticateToken, async (req, res) => {
    const { path: filePath } = req.query;

    if (!filePath) {
        return res.status(400).json({ message: 'Missing file path.' });
    }

    try {
        const absoluteFilePath = getAbsolutePath(filePath);
        const stats = await fs.stat(absoluteFilePath);

        if (stats.isDirectory()) {
            return res.status(400).json({ message: 'Cannot get content of a directory.' });
        }

        const content = await fs.readFile(absoluteFilePath, 'utf8');
        res.json({ content });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'File not found.' });
        }
        console.error('Error reading file content:', error);
        res.status(500).json({ message: 'Failed to read file content.' });
    }
});

// 4. Update File Content
app.put('/api/vfs/file', authenticateToken, async (req, res) => {
    const { path: filePath, content } = req.body;

    if (!filePath) {
        return res.status(400).json({ message: 'Missing file path.' });
    }

    try {
        const absoluteFilePath = getAbsolutePath(filePath);
        const stats = await fs.stat(absoluteFilePath);
        if (stats.isDirectory()) {
            return res.status(400).json({ message: 'Cannot write to a directory.' });
        }

        await fs.writeFile(absoluteFilePath, content, 'utf8');
        res.json({ message: 'File content updated successfully.' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'File not found.' });
        }
        console.error('Error writing file content:', error);
        res.status(500).json({ message: 'Failed to update file content.' });
    }
});

// 5. Delete Item (File or Empty Folder)
app.delete('/api/vfs/delete', authenticateToken, async (req, res) => {
    const { path: itemPath } = req.body;

    if (!itemPath) {
        return res.status(400).json({ message: 'Missing item path.' });
    }

    try {
        const absoluteItemPath = getAbsolutePath(itemPath);
        const stats = await fs.stat(absoluteItemPath);

        if (stats.isDirectory()) {
            const contents = await fs.readdir(absoluteItemPath);
            if (contents.length > 0) {
                return res.status(400).json({ message: 'Cannot delete non-empty folder.' });
            }
            await fs.rmdir(absoluteItemPath);
        } else {
            await fs.unlink(absoluteItemPath);
        }
        res.json({ message: 'Item deleted successfully.' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: 'Item not found.' });
        }
        console.error('Error deleting item:', error);
        res.status(500).json({ message: 'Failed to delete item.' });
    }
});


// --- Package Manager API Endpoints (New!) ---

// Get list of currently installed apps
app.get('/api/apps/installed', authenticateToken, async (req, res) => {
    try {
        const installedApps = JSON.parse(await fs.readFile(APPS_MANIFEST_FILE, 'utf8'));
        res.json(installedApps);
    } catch (error) {
        console.error('Error getting installed apps:', error);
        res.status(500).json({ message: 'Failed to retrieve installed apps.' });
    }
});

// Install an app from a .pakapp file in VFS
app.post('/api/apps/install', authenticateToken, async (req, res) => {
    const { packagePath } = req.body; // e.g., '/downloads/helloworld.pakapp'

    if (!packagePath) {
        return res.status(400).json({ message: 'Package path is required.' });
    }

    try {
        const absolutePackagePath = getAbsolutePath(packagePath);

        // 1. Read the .pakapp file from VFS
        let pakappContent;
        try {
            pakappContent = await fs.readFile(absolutePackagePath, 'utf8');
        } catch (readError) {
            if (readError.code === 'ENOENT') {
                return res.status(404).json({ message: `Package file not found at ${packagePath}.` });
            }
            throw readError;
        }

        // 2. Parse and validate .pakapp content
        let appMetadata;
        try {
            appMetadata = JSON.parse(pakappContent);
        } catch (parseError) {
            return res.status(400).json({ message: 'Invalid .pakapp file format. Must be valid JSON.' });
        }

        const { appId, title, componentName, description } = appMetadata;

        if (!appId || !title || !componentName) {
            return res.status(400).json({ message: 'Invalid .pakapp: missing appId, title, or componentName.' });
        }

        // Check if componentName exists in our predefined list (i.e., frontend knows how to render it)
        const matchedPredefinedApp = PREDEFINED_APPS.find(app => app.appId === appId && app.componentName === componentName);
        if (!matchedPredefinedApp) {
            return res.status(400).json({ message: `App ID "<span class="math-inline">\{appId\}" with component "</span>{componentName}" is not a recognized predefined app.` });
        }

        // 3. Add to installed apps manifest
        const installedApps = JSON.parse(await fs.readFile(APPS_MANIFEST_FILE, 'utf8'));

        if (installedApps.some(app => app.appId === appId)) {
            return res.status(409).json({ message: `App "${appId}" is already installed.` });
        }

        const newInstalledApp = {
            appId: matchedPredefinedApp.appId,
            title: matchedPredefinedApp.title,
            componentName: matchedPredefinedApp.componentName,
            description: matchedPredefinedApp.description || '', // Use predefined description if available
            installedAt: new Date().toISOString(),
        };

        installedApps.push(newInstalledApp);
        await fs.writeFile(APPS_MANIFEST_FILE, JSON.stringify(installedApps, null, 2), 'utf8');

        res.status(200).json({ message: `App "${title}" installed successfully!`, app: newInstalledApp });

    } catch (error) {
        console.error('Error installing app:', error);
        res.status(500).json({ message: 'Failed to install app.' });
    }
});

// Uninstall an app
app.delete('/api/apps/uninstall', authenticateToken, async (req, res) => {
    const { appId } = req.body; // Expects appId to uninstall

    if (!appId) {
        return res.status(400).json({ message: 'App ID is required for uninstallation.' });
    }

    try {
        let installedApps = JSON.parse(await fs.readFile(APPS_MANIFEST_FILE, 'utf8'));
        const initialLength = installedApps.length;
        installedApps = installedApps.filter(app => app.appId !== appId);

        if (installedApps.length === initialLength) {
            return res.status(404).json({ message: `App "${appId}" not found in installed apps.` });
        }

        await fs.writeFile(APPS_MANIFEST_FILE, JSON.stringify(installedApps, null, 2), 'utf8');
        res.status(200).json({ message: `App "${appId}" uninstalled successfully.` });
    } catch (error) {
        console.error('Error uninstalling app:', error);
        res.status(500).json({ message: 'Failed to uninstall app.' });
    }
});


// --- Start the Server ---
ensureDataStructuresExist().then(() => {
    app.listen(PORT, () => {
        console.log(`Node.js VFS & Auth Server running on http://localhost:${PORT}`);
        console.log(`User data will be stored in: ${USERS_FILE}`);
        console.log(`VFS data will be stored in: ${VFS_ROOT_DIR}`);
        console.log(`Installed apps manifest: ${APPS_MANIFEST_FILE}`);
        console.log('\n--- IMPORTANT ---');
        console.log('Ensure the React frontend also connects to this server.');
        console.log('For production, ensure passwords are properly hashed and sessions are more robust.');
    });
});