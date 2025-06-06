// CrusadeFileSystem.js - Handles all Crusade Virtual File System (CVFS) operations
import path from '../utils/path';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export class CrusadeFileSystem {
    constructor(token, onError, onSessionExpired) {
        this.token = token;
        this.onError = onError;
        this.onSessionExpired = onSessionExpired;
        this.abortController = null;
    }    // Helper function to validate paths
    validatePath(pathToValidate) {
        if (!pathToValidate || typeof pathToValidate !== 'string') {
            throw new Error('Invalid path provided');
        }
        
        // Ensure path starts with / and normalize it
        let normalizedPath = pathToValidate.replace(/\\/g, '/');
        normalizedPath = normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath;
        normalizedPath = normalizedPath.replace(/\/+/g, '/').replace(/\/+$/, '');
        
        if (normalizedPath.includes('..')) {
            throw new Error('Invalid path: path traversal not allowed');
        }
        
        // If normalization results in empty string, treat as root
        if (!normalizedPath || normalizedPath === '') {
            return '/';
        }
        return normalizedPath;
    }

    // Base API call method
    async apiCall(endpoint, options = {}) {
        try {
            this.abortController?.abort();
            this.abortController = new AbortController();

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                signal: this.abortController.signal
            });

            if (response.status === 403) {
                await this.onSessionExpired();
                return null;
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Server error');
            }

            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                return null;
            }
            this.handleError(error);
            throw error;
        }
    }

    // Error handling
    handleError(error, action) {
        const errorMessages = {
            'ENOENT': 'File or directory not found',
            'EACCES': 'Permission denied',
            'EEXIST': 'File or directory already exists',
            'EISDIR': 'Path is a directory when file expected',
            'ENOTDIR': 'Path is not a directory when directory expected',
            'ENOTEMPTY': 'Directory not empty'
        };
        
        const code = error.code || '';
        const message = errorMessages[code] || error.message || 'Unknown error occurred';
        
        this.onError(message);
        return message;
    }

    // File system operations
    async listDirectory(dirPath) {
        const validPath = this.validatePath(dirPath);
        return this.apiCall(`/api/cvfs/list?path=${encodeURIComponent(validPath)}`);
    }

    async getItemMetadata(itemPath) {
        const validPath = this.validatePath(itemPath);
        return this.apiCall(`/api/cvfs/metadata?path=${encodeURIComponent(validPath)}`);
    }

    async createItem(parentPath, name, type) {
        const validPath = this.validatePath(parentPath);
        const sanitizedName = name.trim().replace(/[<>:"/\\|?*]/g, '');
        if (!sanitizedName) {
            throw new Error('File or folder name cannot be blank or only invalid characters');
        }
        if (!type || (type !== 'file' && type !== 'folder')) {
            throw new Error('Invalid type: must be "file" or "folder"');
        }
        if (!validPath) {
            throw new Error('Invalid parent path');
        }
        // Debug log outgoing request
        if (process.env.NODE_ENV === 'development') {
            console.debug('CVFS createItem request:', { path: validPath, name: sanitizedName, type });
        }
        return this.apiCall('/api/cvfs/create', {
            method: 'POST',
            body: JSON.stringify({ 
                path: validPath, 
                name: sanitizedName, 
                type 
            })
        });
    }

    async deleteItem(itemPath, recursive = false) {
        const validPath = this.validatePath(itemPath);
        const endpoint = recursive ? '/api/cvfs/delete-recursive' : '/api/cvfs/delete';
        
        return this.apiCall(endpoint, {
            method: 'DELETE',
            body: JSON.stringify({ path: validPath })
        });
    }

    async moveItem(sourcePath, destinationPath) {
        const validSourcePath = this.validatePath(sourcePath);
        const validDestPath = this.validatePath(destinationPath);
        
        return this.apiCall('/api/cvfs/move', {
            method: 'POST',
            body: JSON.stringify({ 
                sourcePath: validSourcePath, 
                destinationPath: validDestPath 
            })
        });
    }

    async copyItem(sourcePath, destinationPath) {
        const validSourcePath = this.validatePath(sourcePath);
        const validDestPath = this.validatePath(destinationPath);
        
        return this.apiCall('/api/cvfs/copy', {
            method: 'POST',
            body: JSON.stringify({ 
                sourcePath: validSourcePath, 
                destinationPath: validDestPath 
            })
        });
    }

    // Clean up method
    cleanup() {
        this.abortController?.abort();
    }
}
