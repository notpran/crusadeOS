# CrusadeOS

**CrusadeOS** is a locally hosted, OS-like web application designed for personal use and as a fun project. It aims to provide a desktop-like experience directly in your browser, with all user data and system files stored securely on your local machine, managed by a dedicated Node.js backend.

## ⚠️ Important Notes ⚠️

## ⚠️This is a **WEB OPERATING SYSTEM** not a real operating system, so it needs an actual operating system (like Windows, macOS, or Linux) AND a functioning and up-to-date browser (like Chrome, Firefox, Edge, etc.) AND Node.js or it CANNOT RUN! ⚠️

## ⚠️This OS is also in early beta, so don't expect many features.

---

## ✨ Features

CrusadeOS is built with modularity and functionality in mind, offering a growing set of features:

* **🌐 Fully Local Architecture:**
    * **Local Backend:** A Node.js Express server runs on your local machine.
    * **Local Data Storage:** All user data, virtual file system (VFS) files, and application manifests are stored directly in a designated folder on your local disk (`server/data/`). No cloud storage is used for user data.
    * **Web Frontend:** A React application runs in your browser, communicating with the local Node.js server via API calls.

* **🔐 Local User Authentication:**
    * **Signup/Login:** Create and manage user accounts directly on your local server.
    * **Secure Passwords:** Passwords are hashed using `bcrypt` before storage.
    * **Session Management:** Simple token-based authentication for API access.

* **🗂️ Virtual File System (VFS):**
    * **File Explorer:** A graphical interface to browse, create, and delete files and folders within your virtual file system.
    * **Text Editor:** Open and edit text files directly within a dedicated window. Changes are saved to your local VFS.
    * **Hierarchical Structure:** Organize your files and folders in a familiar tree-like structure.

* **💻 Terminal Application:**
    * A command-line interface for interacting with CrusadeOS.
    * **Basic Commands:**
        * `ls [path]`: List directory contents.
        * `cd <path>`: Change current working directory.
        * `mkdir <name>`: Create a new directory.
        * `cf <name>`: Create an empty file.
        * `help`: Displays a list of available commands.

* **📦 Package Manager (`pkgm`):**
    * **`pkgm install <path/to/package.pakapp>`:** Install new applications from `.pakapp` manifest files located in your VFS. This registers the app with the OS.
    * **`pkgm list-installed`:** View all currently installed applications.
    * **`pkgm uninstall <app_id>`:** Remove an installed application.

* **🖥️ Desktop Environment:**
    * **Dynamic Window Manager:** Drag, resize, minimize, maximize, and close application windows.
    * **Taskbar/Dock:** Launch applications, switch between open windows, and access system functions.
    * **Apps Menu:** A centralized menu displaying all installed applications for easy launching.

---

## 🚀 Getting Started

Follow these instructions to set up and run CrusadeOS on your local machine.

### Prerequisites

Before you begin, ensure you have the following installed:

* **Node.js:** Version 18.x LTS or higher
    * [Download Node.js](https://nodejs.org/en/download/)

### Installation Guide

1.  **Clone the Repository:**
    First, clone the CrusadeOS repository to your local machine:
    ```bash
    git clone [https://github.com/your-username/CrusadeOS.git](https://github.com/your-username/CrusadeOS.git) # Replace with your actual repo URL
    cd CrusadeOS
    ```

2.  **Run the Unified Setup & Start Script:**
    CrusadeOS includes a convenient `boot.js` script that handles installing all dependencies for both the backend and frontend, and then starts both servers.

    ```bash
    node boot.js
    ```

    This script will:
    * Navigate into `server/`, run `npm install`.
    * **Automatically create the necessary data folders (`server/data/`, `server/data/vfs_data/`) and initial JSON files (`users.json`, `apps_manifest.json`) if they don't exist.**
    * Navigate into `frontend/`, run `npm install`.
    * Automatically configure Tailwind CSS for the frontend (this step is crucial and handled by the `npm install` and `npx tailwindcss init -p` commands executed by the script).
    * Start the Node.js backend server (usually on `http://localhost:5000`).
    * Start the React frontend development server (usually on `http://localhost:3000`).

### How to Use CrusadeOS

1.  **Access the Application:**
    Once `node boot.js` has finished starting both servers, open your web browser and navigate to:
    `http://localhost:3000`

2.  **Login/Signup:**
    * You'll be greeted by a login screen. Create a new user account (username and password) to get started.
    * After successful signup/login, you'll enter the CrusadeOS desktop environment.

3.  **Explore Features:**
    * **Taskbar:** At the bottom of the screen, you'll find buttons to launch applications like "File Explorer" and "Terminal," and an "Apps" menu.
    * **File Explorer:** Use it to create folders (`mkdir`), create files (`cf`), navigate (`cd`), and manage your local virtual files. Double-click text files to open them in the Text Editor.
    * **Terminal:** Open the Terminal app to interact with the OS using command-line commands. Type `help` for a list of available commands.
    * **Package Manager (`pkgm`):**
        * **Install Apps:** To install a predefined app (like "Hello World"), you first need its `.pakapp` manifest file in your VFS. For example, you can manually create a `downloads` folder in `server/data/vfs_data/` and place sample `.pakapp` files there (see examples below). Then, in the Terminal, navigate to `/downloads` and run `pkgm install /downloads/hello-world-app.pakapp`.
        * **Sample `.pakapp` content:**
            ```json
            // server/data/vfs_data/downloads/hello-world-app.pakapp
            {
              "appId": "hello-world-app",
              "title": "Hello World",
              "componentName": "HelloWorldApp",
              "description": "A classic first app for your Web OS."
            }
            ```
            (You can create similar `.pakapp` files for `file-explorer-app`, `text-editor-app`, `terminal-app` using their respective `appId` and `componentName` from the backend's `PREDEFINED_APPS` list).
        * Installed apps will appear in the "Apps" menu.

4.  **Logout:** Use the "Logout" button on the Taskbar to end your session.

### Stopping CrusadeOS

To stop both the backend and frontend servers, simply go to the terminal where you ran `node boot.js` and press `Ctrl+C`.

---

## 🛠️ Development & Customization

* **Frontend:** The React application is located in the `frontend/` directory.
    * `frontend/src/apps/`: Contains individual application components.
    * `frontend/src/components/`: Reusable UI components (windows, taskbar, etc.).
    * `frontend/src/context/AuthContext.js`: Manages local authentication state.
* **Backend:** The Node.js Express server is in the `server/` directory.
    * `server/server.js`: Main server logic, API endpoints for VFS and authentication.
    * `server/data/`: Stores all persistent user and VFS data.

Feel free to explore the codebase, add new applications, implement more terminal commands, or enhance the UI!

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features, bug fixes, or improvements, please feel free to open issues or pull requests.

## 📄 License

This project is open-source and available under the [MIT License](https://opensource.org/licenses/MIT).
