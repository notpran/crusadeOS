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
 * @param {number} backendPort The port where the backend server is running.
 * @param {number} frontendPort The port where the React frontend will be served.
 * @returns {string} The complete HTML string for the loading page.
 */
const generateLoadingPageHtml = (backendPort, frontendPort) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Crusade OS Loading</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        /* Custom styles for the loading screen, inspired by macOS */
        body {
            margin: 0;
            overflow: hidden; /* Prevent scrolling */
            font-family: 'Inter', sans-serif; /* Use Inter font */
            background-color: #1a202c; /* Dark background, similar to macOS boot */
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh; /* Full viewport height */
            color: #e2e8f0; /* Light text color */
        }

        .os-logo {
            width: 80px;
            height: 80px;
            background-color: #3b82f6; /* Blue circle for OS icon */
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            font-weight: bold;
            color: #ffffff;
            box-shadow: 0 10px 15px rgba(0, 0, 0, 0.3); /* Subtle shadow */
            margin-bottom: 24px;
        }

        .os-name {
            font-size: 3.5rem;
            font-weight: 800;
            color: #e2e8f0; /* Light gray text */
            margin-bottom: 32px;
        }

        .loading-bar-container {
            width: 320px; /* Fixed width for the bar */
            height: 8px;
            background-color: #4a5568; /* Darker gray for empty bar */
            border-radius: 9999px; /* Fully rounded corners */
            overflow: hidden;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2); /* Inner shadow for depth */
        }

        .loading-bar-fill {
            width: 0%; /* Initial width */
            height: 100%;
            background: linear-gradient(to right, #60a5fa, #3b82f6); /* Blue gradient fill */
            border-radius: 9999px;
            transition: width 0.5s ease-out; /* Smooth transition for progress updates */
        }

        .status-text {
            margin-top: 16px;
            font-size: 0.875rem; /* text-sm */
            color: #a0aec0; /* gray-400 */
        }
    </style>
</head>
<body>
    <div class="os-logo">OS</div>
    <div class="os-name">Crusade OS</div>
    <div class="loading-bar-container">
        <div id="loading-bar-fill" class="loading-bar-fill"></div>
    </div>
    <p id="status-text" class="status-text">Starting up...</p>

    <script>
        // JavaScript to manage the loading animation and redirect
        const backendUrl = 'http://localhost:${backendPort}/api/health';
        const frontendUrl = 'http://localhost:${frontendPort}';
        const loadingBar = document.getElementById('loading-bar-fill');
        const statusText = document.getElementById('status-text');

        let currentProgress = 0;
        let pollingAttempts = 0;
        const maxPollingAttempts = 60; // Max 60 seconds (1s interval) for backend polling

        // Function to animate the initial visual progress of the loading bar
        function animateInitialProgress() {
            let initialFill = 0;
            const initialInterval = setInterval(() => {
                if (initialFill < 30) { // Fill up to 30% quickly to show immediate activity
                    initialFill += 5;
                    loadingBar.style.width = \`\${initialFill}%\`;
                    statusText.textContent = 'Initializing system...';
                } else {
                    clearInterval(initialInterval);
                    // Once initial visual progress is done, start polling the backend
                    pollBackend();
                }
            }, 100); // Update every 100ms for quick initial fill
        }

        // Function to poll the backend health check endpoint
        async function pollBackend() {
            statusText.textContent = 'Connecting to backend services...';
            const pollingIntervalId = setInterval(async () => {
                pollingAttempts++;
                if (pollingAttempts > maxPollingAttempts) {
                    statusText.textContent = 'Backend connection timed out. Please check server logs and refresh.';
                    clearInterval(pollingIntervalId);
                    // At this point, you might want to display a permanent error or a retry button
                    return;
                }

                try {
                    const response = await fetch(backendUrl);
                    if (response.ok) {
                        // Backend is ready!
                        statusText.textContent = 'Backend ready. Launching frontend...';
                        loadingBar.style.width = '100%'; // Complete the bar to 100%
                        clearInterval(pollingIntervalId); // Stop polling

                        // Give a small delay for the 100% bar to be visible, then redirect
                        setTimeout(() => {
                            window.location.href = frontendUrl; // Redirect to the React frontend
                        }, 500);
                    } else {
                        // Backend responded but not with a success status (e.g., 404, 500)
                        console.warn(\`Backend health check failed with status: \${response.status}\`);
                        statusText.textContent = \`Waiting for backend... (Attempt \${pollingAttempts})\`;
                        // Increment progress slightly while waiting for backend, but don't reach 100%
                        if (currentProgress < 90) {
                            currentProgress = Math.min(currentProgress + 1, 90);
                            loadingBar.style.width = \`\${currentProgress}%\`;
                        }
                    }
                } catch (error) {
                    // Network error, backend not reachable yet
                    console.error('Error connecting to backend:', error);
                    statusText.textContent = \`Connecting to backend... (Attempt \${pollingAttempts})\`;
                    // Increment progress slightly even on network errors
                    if (currentProgress < 90) {
                        currentProgress = Math.min(currentProgress + 1, 90);
                        loadingBar.style.width = \`\${currentProgress}%\`;
                    }
                }
            }, 1000); // Poll every 1 second
        }

        // Start the initial animation when the DOM is fully loaded
        document.addEventListener('DOMContentLoaded', animateInitialProgress);
    </script>
</body>
</html>
`;

/**
 * Main function to set up and start the project.
 */
async function startProject() {
    console.log("✨ Starting CrusadeOS");

    // 1. Start a temporary Express server to serve the initial loading screen
    const loadingApp = express();
    loadingApp.get('/', (req, res) => {
        res.send(generateLoadingPageHtml(BACKEND_PORT, FRONTEND_PORT));
    });

    // Start the loading screen server immediately.
    // The user will navigate to this URL first.
    let loadingServer;
    try {
        loadingServer = loadingApp.listen(LOADING_SCREEN_PORT, () => {
            const loadingUrl = `http://localhost:${LOADING_SCREEN_PORT}`;
            console.log(`\n🌐 Initial loading screen available at ${loadingUrl}`);
            console.log('Automatically opening in your browser...');
            // Check if 'open' is a function or if 'open.default' is a function
            if (typeof open === 'function') {
                open(loadingUrl); // Use 'open' directly if it's a function
            } else if (typeof open.default === 'function') {
                open.default(loadingUrl); // Use 'open.default' if it's a function
            } else {
                console.warn("The 'open' package is not correctly imported or is not a function. Please ensure it's installed and correctly exported.");
                console.warn("You may need to manually open: " + loadingUrl);
            }
        });
    } catch (err) {
        console.error(`❌ Failed to start loading screen server on port ${LOADING_SCREEN_PORT}: ${err.message}`);
        console.error('This might mean the port is already in use. Please free it up or choose a different port.');
        process.exit(1); // Exit if the loading server cannot start
    }

    // Introduce a delay before starting other processes
    const initialDelayMs = 1500; // 1.5 seconds delay
    console.log(`\n⏳ Waiting for ${initialDelayMs / 1000} seconds before starting backend and frontend...`);
    await new Promise(resolve => setTimeout(resolve, initialDelayMs));

    // 2. Install Backend Dependencies
    installDependencies(backendDir);

    // 3. Install Frontend Dependencies
    installDependencies(frontendDir);

    console.log("\nStarting backend and frontend servers...");

    // 4. Start Backend
    const backendProcess = startProcess('npm start', backendDir);

    // 5. Start Frontend
    const frontendProcess = startProcess('npm start', frontendDir);

    console.log("\n✅ Backend and Frontend processes started successfully!");
    console.log(`💡 Your main application will be available at http://localhost:${FRONTEND_PORT} after the loading sequence completes.`);
    console.log("Press Ctrl+C to stop all processes.");

    // Handle Ctrl+C (SIGINT) to gracefully kill all child processes
    process.on('SIGINT', () => {
        console.log('\nStopping backend and frontend processes...');
        if (backendProcess) backendProcess.kill('SIGINT');
        if (frontendProcess) frontendProcess.kill('SIGINT');
        if (loadingServer) loadingServer.close(() => console.log('Loading screen server closed.'));
        process.exit();
    });

    process.on('SIGTERM', () => {
        console.log('\nStopping backend and frontend processes...');
        if (backendProcess) backendProcess.kill('SIGTERM');
        if (frontendProcess) frontendProcess.kill('SIGTERM');
        if (loadingServer) loadingServer.close(() => console.log('Loading screen server closed.'));
        process.exit();
    });
}

// Execute the main project startup function
startProject();
