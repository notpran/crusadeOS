const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = __dirname;
const backendDir = path.join(rootDir, 'server');
const frontendDir = path.join(rootDir, 'frontend');

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
 * Main function to set up and start the project.
 */
async function startProject() {
    console.log("✨ Starting CrusadeOS");

    // 1. Install Backend Dependencies
    installDependencies(backendDir);

    // 2. Install Frontend Dependencies
    installDependencies(frontendDir);

    console.log("\nStarting backend and frontend servers...");

    // 3. Start Backend
    const backendProcess = startProcess('npm start', backendDir);

    // 4. Start Frontend
    const frontendProcess = startProcess('npm start', frontendDir);

    console.log("\n✅ Backend and Frontend processes started successfully!");
    console.log("💡 You can now open your browser to http://localhost:3000 (or whatever port your frontend runs on).");
    console.log("Press Ctrl+C to stop both processes.");

    // Handle Ctrl+C (SIGINT) to gracefully kill both child processes
    process.on('SIGINT', () => {
        console.log('\nStopping backend and frontend processes...');
        if (backendProcess) backendProcess.kill('SIGINT');
        if (frontendProcess) frontendProcess.kill('SIGINT');
        process.exit();
    });

    process.on('SIGTERM', () => {
        console.log('\nStopping backend and frontend processes...');
        if (backendProcess) backendProcess.kill('SIGTERM');
        if (frontendProcess) frontendProcess.kill('SIGTERM');
        process.exit();
    });
}

startProject();