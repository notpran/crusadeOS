// frontend/src/utils/path.js

// A minimal path utility to replace Node's path module in the browser
const path = {
    basename(path) {
        // Handle both Windows and Unix-style paths
        const parts = path.split(/[\\/]/);
        return parts[parts.length - 1] || '';
    },

    join(...parts) {
        // Filter out empty parts and join with forward slashes
        return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
    },

    dirname(path) {
        // Handle both Windows and Unix-style paths
        const parts = path.split(/[\\/]/);
        parts.pop();
        return parts.join('/') || '/';
    },

    normalize(path) {
        // Convert backslashes to forward slashes and remove duplicate slashes
        return path.replace(/\\/g, '/').replace(/\/+/g, '/');
    }
};

export default path;
