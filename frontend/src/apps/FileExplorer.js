import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNotifications } from '../components/NotificationSystem';
import { useAuth } from '../context/AuthContext';
import ContextMenu from '../components/ContextMenu';
import path from '../utils/path';
import { CrusadeFileSystem } from '../services/CrusadeFileSystem';

// Helper function to format file sizes
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// FileExplorer component
const FileExplorer = ({ onOpenFile }) => {
  const { addNotification } = useNotifications();
  const { token, logout } = useAuth();
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState('folder');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [clipboardItem, setClipboardItem] = useState(null);
  const operationInProgressRef = useRef(false);
  const lastFetchRef = useRef(Date.now());
  const fs = useRef(null);

  // Setup FileSystem service
  useEffect(() => {
    fs.current = new CrusadeFileSystem(
      token,
      (error) => addNotification(error, 'error'),
      logout
    );
    return () => fs.current?.cleanup();
  }, [token, logout, addNotification]);

  // Debounced fetchItems
  const fetchItems = useCallback(async () => {
    console.log('fetchItems called', currentPath); // DEBUG: log at function start
    const now = Date.now();
    if (now - lastFetchRef.current < 500) {
      console.log('fetchItems debounced/skipped', currentPath); // DEBUG: log if debounced
      return; // Debounce fetches
    }
    lastFetchRef.current = now;

    if (loading || !fs.current || operationInProgressRef.current) {
      console.log('fetchItems skipped due to loading/fs/opInProgress', { loading, fsCurrent: !!fs.current, op: operationInProgressRef.current }); // DEBUG
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await fs.current.listDirectory(currentPath);
      console.log('Fetched items:', data); // DEBUG: log backend response
      setItems(data || []);
      // Update breadcrumbs
      const pathParts = currentPath.split('/').filter(Boolean);
      setBreadcrumbs([{ name: 'Root', path: '/' }, ...pathParts.map((part, index) => ({
        name: part,
        path: '/' + pathParts.slice(0, index + 1).join('/')
      }))]);
    } catch (error) {
      const message = error.message || 'Error fetching items';
      setErrorMessage(message);
      addNotification(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPath, loading, addNotification]);

  // Queue operations to prevent concurrent file system operations
  const queueOperation = useCallback(async (operation) => {
    if (operationInProgressRef.current) {
      addNotification('An operation is already in progress', 'warning');
      return null;
    }

    try {
      operationInProgressRef.current = true;
      await operation();
      await fetchItems();
    } finally {
      operationInProgressRef.current = false;
    }
  }, [fetchItems, addNotification]);

  // Navigation handler
  const navigateToFolder = useCallback((folderName) => {
    const newPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
    setCurrentPath(newPath);
  }, [currentPath]);

  // Handle item double click
  const handleItemDoubleClick = useCallback((item) => {
    if (item.type === 'folder') {
      navigateToFolder(item.name);
    } else {
      onOpenFile(path.join(currentPath, item.name));
    }
  }, [currentPath, navigateToFolder, onOpenFile]);

  // Handle paste
  const handlePaste = useCallback(async (destinationPath) => {
    if (!clipboardItem) return;
    
    await queueOperation(async () => {
      try {
        if (clipboardItem.operation === 'cut') {
          await fs.current.moveItem(clipboardItem.path, path.join(destinationPath, path.basename(clipboardItem.path)));
        } else {
          await fs.current.copyItem(clipboardItem.path, path.join(destinationPath, path.basename(clipboardItem.path)));
        }
        setClipboardItem(null);
      } catch (error) {
        addNotification(error.message, 'error');
      }
    });
  }, [clipboardItem, queueOperation, addNotification]);

  // Context menu actions
  const handleContextMenu = useCallback((e, item) => {
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      items: [
        {
          label: 'Cut',
          onClick: () => {
            setClipboardItem({ path: path.join(currentPath, item.name), operation: 'cut' });
            setContextMenu(null);
          }
        },
        {
          label: 'Copy',
          onClick: () => {
            setClipboardItem({ path: path.join(currentPath, item.name), operation: 'copy' });
            setContextMenu(null);
          }
        },
        {
          label: 'Paste',
          disabled: !clipboardItem,
          onClick: () => {
            handlePaste(currentPath);
            setContextMenu(null);
          }
        },
        {
          label: 'Delete',
          onClick: async () => {
            await queueOperation(async () => {
              try {
                await fs.current.deleteItem(path.join(currentPath, item.name));
                addNotification(`${item.name} deleted successfully`, 'success');
              } catch (error) {
                addNotification(error.message, 'error');
              }
            });
            setContextMenu(null);
          }
        }
      ]
    });
  }, [currentPath, clipboardItem, queueOperation, addNotification, handlePaste]);

  // Update items when path changes
  useEffect(() => {
    fetchItems();
  }, [currentPath, fetchItems]);

  // Render UI
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
      {/* Breadcrumb navigation */}
      <div className="flex items-center p-2 border-b dark:border-gray-700">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            {index > 0 && <span className="mx-2">/</span>}
            <button
              onClick={() => setCurrentPath(crumb.path)}
              className="hover:underline focus:outline-none"
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* File operations toolbar */}
      <div className="flex items-center p-2 gap-2 border-b dark:border-gray-700">
        <button
          onClick={() => {
            setNewItemType('folder');
            setNewItemName('');
          }}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={operationInProgressRef.current}
        >
          New Folder
        </button>
        <button
          onClick={() => {
            setNewItemType('file');
            setNewItemName('');
          }}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={operationInProgressRef.current}
        >
          New File
        </button>
      </div>

      {/* New item input */}
      {newItemType && (
        <div className="flex items-center p-2 gap-2 border-b dark:border-gray-700">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={`Enter ${newItemType} name`}
            className="flex-1 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
            autoFocus
          />
          <button
            onClick={() => {
              if (!newItemName.trim()) {
                addNotification('Name cannot be empty or whitespace.', 'error');
                return;
              }
              // Clear input state before queueing operation to avoid race conditions
              const name = newItemName.trim();
              const type = newItemType;
              setNewItemName('');
              setNewItemType('');
              queueOperation(async () => {
                try {
                  await fs.current.createItem(currentPath, name, type);
                  addNotification(`${type === 'folder' ? 'Folder' : 'File'} created successfully`, 'success');
                } catch (error) {
                  addNotification(error.message || 'Failed to create item.', 'error');
                }
              });
            }}
            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            disabled={!newItemName.trim() || operationInProgressRef.current}
          >
            Create
          </button>
          <button
            onClick={() => {
              setNewItemName('');
              setNewItemType('');
            }}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Cancel
          </button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-500">Loading...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-500">This folder is empty</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 p-2">
            {items.map((item) => (
              <div
                key={item.name}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => item.type === 'folder' ? navigateToFolder(item.name) : null}
                onDoubleClick={() => handleItemDoubleClick(item)}
                onContextMenu={(e) => handleContextMenu(e, item)}
              >
                <div className="flex items-center">
                  <span className="material-icons mr-2">
                    {item.type === 'folder' ? 'folder' : 'description'}
                  </span>
                  <span className="truncate">{item.name}</span>
                </div>
                {item.type === 'file' && item.size != null && (
                  <div className="text-xs text-gray-500 mt-1">
                    {formatFileSize(item.size)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Error message */}
      {errorMessage && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-red-500 text-white">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default FileExplorer;