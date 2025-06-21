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
  // Always use '/' as the root for the current user
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState('folder');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [clipboardItem, setClipboardItem] = useState(null);
  const [shareModal, setShareModal] = useState({ open: false, item: null, users: [] });
  const operationInProgressRef = useRef(false);
  const lastFetchRef = useRef(Date.now());
  const fs = useRef(null);

  // State for pending shares
  const [pendingShares, setPendingShares] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Setup FileSystem service
  useEffect(() => {
    fs.current = new CrusadeFileSystem(
      token,
      (error) => addNotification(error, 'error'),
      logout
    );
    return () => fs.current?.cleanup();
  }, [token, logout, addNotification]);

  // Fetch items from the file system
  const fetchItems = useCallback(async () => {
    console.log('fetchItems called for path:', currentPath);
    
    if (!fs.current) {
      console.log('fetchItems skipped - no fs instance');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const data = await fs.current.listDirectory(currentPath);
      console.log('Fetched items:', data);
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
  }, [currentPath, addNotification]);

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
    // Prevent navigation outside user root
    const newPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
    setCurrentPath(path.normalize(newPath));
  }, [currentPath]);

  // Handle item double click
  const handleItemDoubleClick = useCallback((item) => {
    if (item.type === 'folder') {
      navigateToFolder(item.name);
    } else {
      const ext = item.name.split('.').pop().toLowerCase();
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];
      // Always use single-slash absolute path
      const absPath = currentPath === '/' ? `/${item.name}` : `${currentPath}/${item.name}`;
      if (imageExts.includes(ext)) {
        onOpenFile(absPath, 'image');
      } else {
        onOpenFile(absPath, 'text');
      }
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

  // Fetch users for sharing
  const openShareModal = async (item, userId) => {
    try {
      const users = await fs.current.listUsers();
      setShareModal({ open: true, item, users });
    } catch (error) {
      addNotification('Failed to load users for sharing', 'error');
    }
  };

  // Context menu actions
  const handleContextMenu = useCallback(async (e, item) => {
    e.preventDefault();
    let menuItems = [
      {
        label: 'New folder',
        onClick: () => {
          setNewItemType('folder');
          setNewItemName('');
          // Optionally open a modal or inline input for new folder
        }
      },
      {
        label: 'New file',
        onClick: () => {
          setNewItemType('file');
          setNewItemName('');
          // Optionally open a modal or inline input for new file
        }
      },
      {
        label: 'Paste',
        disabled: !clipboardItem,
        onClick: () => handlePaste(currentPath)
      }
    ];

    if (item) {
      // If an item is selected, add separator and more options
      // Fetch users for share submenu
      let users = [];
      try {
        users = await fs.current.listUsers();
      } catch (err) {}
      menuItems.push({ type: 'separator' });
      menuItems.push(
        {
          label: 'Rename',
          onClick: () => {
            setNewItemName(item.name);
            setNewItemType('rename');
            // Optionally open a modal or inline input for renaming
          }
        },
        {
          label: 'Delete',
          onClick: () => confirmDelete(item)
        },
        {
          label: 'Copy',
          onClick: () => {
            setClipboardItem({ path: path.join(currentPath, item.name), operation: 'copy' });
          }
        },
        {
          label: 'Share',
          submenu: users.filter(u => u.id !== fs.current.token).map(u => ({
            label: u.username,
            onClick: () => openShareModal(item, u.id)
          }))
        }
      );
    }
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      items: menuItems
    });
  }, [currentPath, clipboardItem, queueOperation, addNotification, handlePaste]);

  // Update items when path changes
  useEffect(() => {
    // Always treat '/' as the root for the current user
    fetchItems();
  }, [currentPath, fetchItems]);

  // Fetch file list on mount
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Share modal UI
  const handleShare = async (userId) => {
    try {
      await fs.current.shareItem(path.join(currentPath, shareModal.item.name), userId);
      addNotification('File shared successfully!', 'success');
      setShareModal({ open: false, item: null, users: [] });
    } catch (error) {
      addNotification(error.message || 'Failed to share file.', 'error');
    }
  };

  // Fetch pending shares
  const fetchPendingShares = useCallback(async () => {
    setPendingLoading(true);
    try {
      const shares = await fs.current.listPendingShares();
      setPendingShares(shares || []);
    } catch (error) {
      addNotification('Failed to load pending shares', 'error');
    } finally {
      setPendingLoading(false);
    }
  }, [addNotification]);

  // Accept or deny share
  const handleAcceptShare = async (name) => {
    try {
      await fs.current.acceptShare(name);
      addNotification('Share accepted!', 'success');
      fetchPendingShares();
      fetchItems();
    } catch (error) {
      addNotification(error.message || 'Failed to accept share.', 'error');
    }
  };
  const handleDenyShare = async (name) => {
    try {
      await fs.current.denyShare(name);
      addNotification('Share denied.', 'info');
      fetchPendingShares();
    } catch (error) {
      addNotification(error.message || 'Failed to deny share.', 'error');
    }
  };

  // Load pending shares on mount
  useEffect(() => {
    fetchPendingShares();
  }, [fetchPendingShares]);

  // --- WebSocket for real-time file updates and polling ---
  useEffect(() => {
    if (!token) return;
    let ws;
    let subscribedPath = currentPath;
    let isMounted = true;
    function subscribe() {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'subscribe', path: subscribedPath }));
      }
    }
    ws = new window.WebSocket(`ws://localhost:5000?token=${token}`);
    ws.onopen = () => subscribe();
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file-list') {
          setItems(msg.items || []);
        } else if (msg.event === 'file-change') {
          // Optionally handle file-change events
        }
      } catch (e) { /* ignore */ }
    };
    ws.onerror = (e) => { console.warn('WebSocket error:', e); };
    // Resubscribe on path change
    return () => {
      isMounted = false;
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'unsubscribe' }));
      }
      ws.close();
    };
  }, [token, currentPath]);

  // --- Context menu: ensure right-click works on file/folder and background ---
  const handleBackgroundContextMenu = (e) => {
    if (e.target === e.currentTarget) {
      handleContextMenu(e, null);
    }
  };

  // --- Delete confirmation dialog ---
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, item: null });
  const confirmDelete = (item) => setDeleteConfirm({ open: true, item });
  const doDelete = async () => {
    if (!deleteConfirm.item) return;
    await queueOperation(async () => {
      try {
        await fs.current.deleteItem(path.join(currentPath, deleteConfirm.item.name), true);
        addNotification(`${deleteConfirm.item.name} deleted successfully`, 'success');
      } catch (error) {
        addNotification(error.message, 'error');
      }
    });
    setDeleteConfirm({ open: false, item: null });
  };

  // Add WebSocket event handler after the fs useEffect
  useEffect(() => {
    if (!fs.current) return;

    const handleFileChange = (data) => {
      console.log('File change event received:', data);
      // Only refresh if the change affects our current directory
      if (data.path.startsWith(currentPath)) {
        fetchItems();
      }
    };

    fs.current.addEventListener('fileChange', handleFileChange);
    
    return () => {
      fs.current?.removeEventListener('fileChange', handleFileChange);
    };
  }, [currentPath, fetchItems]);

  // Drag-and-drop upload support
  const handleBackgroundDrop = async (e) => {
    e.preventDefault();
    if (!fs.current || !e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    for (const file of e.dataTransfer.files) {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      try {
        await fs.current.uploadFile(currentPath, file.name, uint8Array);
        addNotification(`Uploaded ${file.name}`, 'success');
      } catch (error) {
        addNotification(`Failed to upload ${file.name}: ${error.message}`, 'error');
      }
    }
    fetchItems();
  };

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
              const name = newItemName.trim();
              const type = newItemType;
              setNewItemName('');
              setNewItemType('');
              console.log('Creating item:', { currentPath, name, type }); // DEBUG
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
      <div className="flex-1 overflow-auto" onContextMenu={handleBackgroundContextMenu} onDrop={handleBackgroundDrop} onDragOver={e => e.preventDefault()}>
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
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex flex-col items-center"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('itemName', item.name);
                  e.dataTransfer.setData('itemType', item.type);
                }}
                onDragOver={(e) => {
                  if (item.type === 'folder') e.preventDefault();
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const draggedName = e.dataTransfer.getData('itemName');
                  const draggedType = e.dataTransfer.getData('itemType');
                  if (item.type === 'folder' && draggedName && draggedName !== item.name) {
                    await queueOperation(async () => {
                      try {
                        await fs.current.moveItem(
                          path.join(currentPath, draggedName),
                          path.join(currentPath, item.name, draggedName)
                        );
                        addNotification(`${draggedType === 'folder' ? 'Folder' : 'File'} moved successfully`, 'success');
                      } catch (error) {
                        addNotification(error.message || 'Failed to move item.', 'error');
                      }
                    });
                  }
                }}
                onClick={() => item.type === 'folder' ? navigateToFolder(item.name) : null}
                onDoubleClick={() => handleItemDoubleClick(item)}
                onContextMenu={(e) => handleContextMenu(e, item)}
              >
                <div className="flex flex-col items-center">
                  <span style={{ fontSize: '2rem' }}>
                    {item.type === 'folder' ? '📁' : '📄'}
                  </span>
                  <span className="truncate w-24 text-center mt-1">{item.name}</span>
                  {item.type === 'file' && item.size != null && (
                    <div className="text-xs text-gray-500 mt-1">
                      {formatFileSize(item.size)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Shares Section */}
      <div className="border-b dark:border-gray-700 p-2">
        <h3 className="font-bold mb-2">Pending Shares</h3>
        {pendingLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : pendingShares.length === 0 ? (
          <div className="text-gray-500">No pending shares</div>
        ) : (
          <ul>
            {pendingShares.map((share) => (
              <li key={share.name} className="flex items-center justify-between mb-2">
                <span>{share.name} ({share.type})</span>
                <div className="flex gap-2">
                  <button
                    className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                    onClick={() => handleAcceptShare(share.name)}
                  >Accept</button>
                  <button
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    onClick={() => handleDenyShare(share.name)}
                  >Deny</button>
                </div>
              </li>
            ))}
          </ul>
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

      {/* Share Modal */}
      {shareModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-80">
            <h2 className="text-lg font-bold mb-2">Share "{shareModal.item.name}"</h2>
            <div className="mb-4">
              {shareModal.users.length === 0 ? (
                <div className="text-gray-500">No other users found.</div>
              ) : (
                <ul>
                  {shareModal.users.map((user) => (
                    <li key={user.id} className="mb-2">
                      <button
                        className="w-full px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={() => handleShare(user.id)}
                      >
                        {user.username}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              className="w-full px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
              onClick={() => setShareModal({ open: false, item: null, users: [] })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg w-80">
            <h2 className="text-lg font-bold mb-2">Confirm Delete</h2>
            <p>Are you sure you want to delete "{deleteConfirm.item?.name}"? This action cannot be undone.</p>
            <div className="flex gap-2 mt-4 justify-end">
              <button className="px-3 py-1 bg-gray-400 text-white rounded" onClick={() => setDeleteConfirm({ open: false, item: null })}>Cancel</button>
              <button className="px-3 py-1 bg-red-600 text-white rounded" onClick={doDelete}>Delete</button>
            </div>
          </div>
        </div>
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