const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const express = require('express'); // Import express for the temporary loading server
const open = require('open'); // Import the 'open' package to automatically open the browser

// For debugging: Log what 'open' is immediately after requiring it
console.log("Value of 'open' after require:", open);


const rootDir = __dirname;
const backendDir = path.join(rootDir, 'server');
const frontendDir = path.join(rootDir, 'frontend');

// Define ports for your services
const LOADING_SCREEN_PORT = 8000; // Port for the initial loading screen served by boot.js
const FRONTEND_PORT = 3000;       // Your React frontend's port
const BACKEND_PORT = 5000;        // Your Node.js backend's port

/**
 * Checks and installs dependencies for a given directory.
 * Runs 'npm install' as it's idempotent and handles missing/updated dependencies.
 * @param {string} directory The path to the project directory (backend or frontend).
 */
function installDependencies(directory) {
    console.log(`\n📦 Checking and installing dependencies in ${path.basename(directory)}...`);
    try {
        // Run npm install in the specified directory
        execSync('npm install', { stdio: 'inherit', cwd: directory });
        console.log(`✅ Dependencies installed for ${path.basename(directory)}.`);
    } catch (error) {
        console.error(`❌ Error installing dependencies for ${path.basename(directory)}:`);
        console.error(error.message);
        process.exit(1); // Exit if dependency installation fails
    }
}

/**
 * Starts a process (e.g., 'npm start') in a given directory.
 * @param {string} command The command to execute (e.g., 'npm start').
 * @param {string} directory The path to the project directory.
 * @returns {ChildProcess} The spawned child process.
 */
function startProcess(command, directory) {
    console.log(`\n🚀 Starting '${command}' in ${path.basename(directory)}...`);
    // 'shell: true' is important for cross-platform compatibility with 'npm' commands
    const child = spawn(command, { cwd: directory, stdio: 'inherit', shell: true });

    child.on('error', (error) => {
        console.error(`❌ Failed to start process in ${path.basename(directory)}: ${error.message}`);
    });

    child.on('exit', (code, signal) => {
        if (code !== 0) {
            console.error(`⚠️ Process in ${path.basename(directory)} exited with code ${code} and signal ${signal}`);
        }
    });

    return child;
}

/**
 * Generates the HTML content for the initial loading screen.
 * This HTML includes inline CSS (Tailwind via CDN) and JavaScript for polling.
 * @param {number} backendPort The port where the system is running.
 * @param {number} frontendPort The port where the desktop will be served.
 * @returns {string} The complete HTML string for the loading page.
 */
const generateLoadingPageHtml = (backendPort, frontendPort, status = 'Welcome to CrusadeOS') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crusade OS Loading</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            font-family: 'Segoe UI', 'Inter', sans-serif;
            background-color: #1a202c;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            color: #e2e8f0;
        }
        .os-logo {
            width: 80px;
            height: 80px;
            background-color: #3b82f6;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            font-weight: bold;
            color: #ffffff;
            box-shadow: 0 10px 15px rgba(0, 0, 0, 0.3);
            margin-bottom: 24px;
        }
        .os-name {
            font-size: 3.5rem;
            font-weight: 800;
            color: #e2e8f0;
            margin-bottom: 32px;
        }
        .loading-bar-container {
            width: 320px;
            height: 8px;
            background-color: #4a5568;
            border-radius: 9999px;
            overflow: hidden;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .loading-bar-fill {
            width: 0%;
            height: 100%;
            background: linear-gradient(to right, #60a5fa, #3b82f6);
            border-radius: 9999px;
            transition: width 0.5s ease-out;
        }
        .status-text {
            margin-top: 16px;
            font-size: 1.25rem;
            color: #a0aec0;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="os-logo">OS</div>
    <div class="os-name">Crusade OS</div>
    <div class="loading-bar-container">
        <div id="loading-bar-fill" class="loading-bar-fill"></div>
    </div>
    <p id="status-text" class="status-text">${status}</p>
    <script>
        const backendUrl = 'http://localhost:${backendPort}/api/health';
        const frontendUrl = 'http://localhost:${frontendPort}';
        const loadingBar = document.getElementById('loading-bar-fill');
        const statusText = document.getElementById('status-text');
        let currentProgress = 0;
        let phase = 0;
        let pollingAttempts = 0;
        const maxPollingAttempts = 60;
        const messages = [
            'Welcome to CrusadeOS',
            'Checking system files...',
            'Starting system services...',
            'System ready! Launching your desktop...',
            'Preparing your desktop...',
            'Almost there...'
        ];
        function setStatus(msg, progress) {
            statusText.textContent = msg;
            if (progress !== undefined) {
                loadingBar.style.width = progress + '%';
            }
        }
        function animateInitialProgress() {
            let initialFill = 0;
            setStatus(messages[0], 5);
            const initialInterval = setInterval(() => {
                if (initialFill < 20) {
                    initialFill += 2;
                    loadingBar.style.width = \`\${initialFill}%\`;
                    if (initialFill === 10) setStatus(messages[1], initialFill);
                } else {
                    clearInterval(initialInterval);
                    pollBackend();
                }
            }, 80);
        }
        async function pollBackend() {
            setStatus(messages[2], 30);
            const pollingIntervalId = setInterval(async () => {
                pollingAttempts++;
                if (pollingAttempts > maxPollingAttempts) {
                    setStatus('Could not start CrusadeOS. Please check and refresh.', 100);
                    clearInterval(pollingIntervalId);
                    return;
                }
                try {
                    const response = await fetch(backendUrl);
                    if (response.ok) {
                        setStatus(messages[3], 60);
                        clearInterval(pollingIntervalId);
                        setTimeout(pollFrontend, 800);
                        return;
                    }
                } catch {}
                if (currentProgress < 50) {
                    currentProgress = Math.min(currentProgress + 1, 50);
                    loadingBar.style.width = \`\${currentProgress}%\`;
                }
            }, 700);
        }
        async function pollFrontend() {
            setStatus(messages[4], 80);
            let tries = 0;
            const maxTries = 60;
            const interval = setInterval(async () => {
                tries++;
                if (tries > maxTries) {
                    setStatus('Could not start your desktop. Please check and refresh.', 100);
                    clearInterval(interval);
                    return;
                }
                try {
                    const res = await fetch(frontendUrl, {mode: 'no-cors'});
                    setStatus(messages[5], 100);
                    clearInterval(interval);
                    setTimeout(() => { window.location.href = frontendUrl; }, 900);
                    return;
                } catch {}
                if (currentProgress < 99) {
                    currentProgress = Math.min(currentProgress + 1, 99);
                    loadingBar.style.width = \`\${currentProgress}%\`;
                }
            }, 700);
        }
        document.addEventListener('DOMContentLoaded', animateInitialProgress);
    </script>
</body>
</html>
`;

/**
 * Checks if a directory exists.
 * @param {string} dirPath
 * @returns {boolean}
 */
function directoryExists(dirPath) {
    try {
        return fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Checks if this is the first run (no user data directory).
 * @returns {boolean}
 */
function isFirstRun() {
    const userDataDir = path.join(backendDir, 'data', 'user_data');
    return !directoryExists(userDataDir);
}

// Helper to wait for a server to be ready
async function waitForServer(url, label, maxAttempts = 60, interval = 1000) {
    let attempts = 0;
    while (attempts < maxAttempts) {
        try {
            const res = await fetch(url);
            if (res.ok) return true;
        } catch {}
        attempts++;
        console.log(`Waiting for the ${label} to be ready... (${attempts})`);
        await new Promise(r => setTimeout(r, interval));
    }
    return false;
}

async function startProject() {
    console.log("✨ Starting CrusadeOS");

    // Detect first run and dependency status
    const backendNodeModules = path.join(backendDir, 'node_modules');
    const frontendNodeModules = path.join(frontendDir, 'node_modules');
    const firstRun = isFirstRun();
    const needsBackendDeps = !directoryExists(backendNodeModules);
    const needsFrontendDeps = !directoryExists(frontendNodeModules);
    let initialStatus = 'Starting up...';
    if (firstRun) initialStatus = 'First-time setup: Getting things ready...';
    else if (needsBackendDeps || needsFrontendDeps) initialStatus = 'Getting setup files...';

    // 1. Start a temporary Express server to serve the initial loading screen
    const loadingApp = express();
    loadingApp.get('/', (req, res) => {
        res.send(generateLoadingPageHtml(BACKEND_PORT, FRONTEND_PORT, initialStatus));
    });

    let loadingServer;
    try {
        loadingServer = loadingApp.listen(LOADING_SCREEN_PORT, () => {
            const loadingUrl = `http://localhost:${LOADING_SCREEN_PORT}`;
            console.log(`\n🌐 Welcome! Your computer is starting at ${loadingUrl}`);
            console.log('Opening in your browser...');
            if (typeof open === 'function') {
                open(loadingUrl);
            } else if (typeof open.default === 'function') {
                open.default(loadingUrl);
            } else {
                console.warn("Couldn't open the browser automatically. Please open: " + loadingUrl);
            }
        });
    } catch (err) {
        console.error(`❌ Couldn't start the welcome screen: ${err.message}`);
        process.exit(1);
    }

    const initialDelayMs = 2000;
    await new Promise(resolve => setTimeout(resolve, initialDelayMs));

    // 2. Install system files
    installDependencies(backendDir);
    installDependencies(frontendDir);

    console.log("\nStarting your system and desktop...");

    // 3. Start system (backend)
    const backendProcess = startProcess('npm start', backendDir);
    // 4. Wait for system to be ready
    const backendReady = await waitForServer(`http://localhost:${BACKEND_PORT}/api/health`, 'system');
    if (!backendReady) {
        console.error('❌ The system could not start. Please check the logs.');
        process.exit(1);
    }
    console.log('✅ System is ready!');

    // 5. Start desktop (frontend)
    const frontendProcess = startProcess('npm start', frontendDir);
    // 6. Wait for desktop to be ready
    const frontendReady = await waitForServer(`http://localhost:${FRONTEND_PORT}`, 'desktop');
    if (!frontendReady) {
        console.error('❌ The desktop could not start. Please check the logs.');
        process.exit(1);
    }
    console.log('✅ Desktop is ready!');

    // 7. Do NOT open the main app in the browser here (the loading screen will redirect)
    console.log(`\n💡 Your computer is ready at http://localhost:${FRONTEND_PORT}`);

    // Handle Ctrl+C (SIGINT) to gracefully kill all child processes
    process.on('SIGINT', () => {
        console.log('\nStopping your system and desktop...');
        if (backendProcess) backendProcess.kill('SIGINT');
        if (frontendProcess) frontendProcess.kill('SIGINT');
        if (loadingServer) loadingServer.close(() => console.log('Welcome screen closed.'));
        process.exit();
    });

    process.on('SIGTERM', () => {
        console.log('\nStopping your system and desktop...');
        if (backendProcess) backendProcess.kill('SIGTERM');
        if (frontendProcess) frontendProcess.kill('SIGTERM');
        if (loadingServer) loadingServer.close(() => console.log('Welcome screen closed.'));
        process.exit();
    });
}

// Execute the main project startup function
startProject();
