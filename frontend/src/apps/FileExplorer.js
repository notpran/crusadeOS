import React, { useState, useEffect, useCallback } from 'react';

const FileExplorer = ({ onOpenFile, token }) => {
  const [currentPath, setCurrentPath] = useState('/'); // e.g., '/' or '/documents/my-folder'
  const [items, setItems] = useState([]); // Files and folders in current path
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState('folder'); // 'folder' or 'file'
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Used to manually trigger re-fetch

  // Function to fetch items for the current path
  const fetchItems = useCallback(async () => {
    setItems([]); // Clear previous items
    setMessage('');
    setErrorMessage('');

    try {
      const response = await fetch(`http://localhost:5000/api/vfs/list?path=${encodeURIComponent(currentPath)}`, {
        headers: {
            'Authorization': `Bearer ${token}` // Include token
        }
      });
      const data = await response.json();

      if (response.ok) {
        // Sort folders first, then files, alphabetically
        data.sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
        });
        setItems(data);
      } else {
        setErrorMessage(data.message || 'Failed to load items.');
      }
    } catch (error) {
      console.error("Error fetching VFS items:", error);
      setErrorMessage("Failed to connect to local server or load items. Ensure server is running.");
    }
  }, [currentPath, refreshTrigger, token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Function to create a new item (folder or file)
  const createNewItem = async () => {
    if (!newItemName.trim()) {
      setErrorMessage('Name cannot be empty.');
      return;
    }
    setMessage('');
    setErrorMessage('');

    try {
      const response = await fetch('http://localhost:5000/api/vfs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Include token
        },
        body: JSON.stringify({ path: currentPath, name: newItemName.trim(), type: newItemType }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || `${newItemType === 'folder' ? 'Folder' : 'File'} created successfully.`);
        setNewItemName(''); // Clear input
        setRefreshTrigger(prev => prev + 1); // Trigger re-fetch
      } else {
        setErrorMessage(data.message || 'Failed to create item.');
      }
    } catch (error) {
      console.error("Error creating new item:", error);
      setErrorMessage("Failed to connect to local server or create item.");
    }
  };

  // Function to navigate into a folder
  const navigateToFolder = (folderName) => {
    setCurrentPath(prevPath => {
      const newPath = prevPath === '/' ? `/${folderName}` : `${prevPath}/${folderName}`;
      return newPath;
    });
  };

  // Function to navigate up to the parent folder
  const navigateUp = () => {
    setCurrentPath(prevPath => {
      if (prevPath === '/') return '/'; // Already at root
      const parts = prevPath.split('/').filter(Boolean);
      parts.pop(); // Remove last part
      return parts.length === 0 ? '/' : `/${parts.join('/')}`;
    });
  };

  // Function to delete an item
  const deleteItem = async (itemName, itemType) => {
    setMessage('');
    setErrorMessage('');

    const itemPath = currentPath === '/' ? `/${itemName}` : `${currentPath}/${itemName}`;

    const confirmDelete = window.confirm(`Are you sure you want to delete "${itemName}"?`);
    if (!confirmDelete) return;

    try {
      const response = await fetch('http://localhost:5000/api/vfs/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Include token
        },
        body: JSON.stringify({ path: itemPath }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage(data.message || `"${itemName}" deleted successfully.`);
        setRefreshTrigger(prev => prev + 1); // Trigger re-fetch
      } else {
        setErrorMessage(data.message || 'Failed to delete item.');
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      setErrorMessage("Failed to connect to local server or delete item.");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex space-x-2">
          <button
            onClick={navigateUp}
            className="p-2 rounded-md bg-gray-600 hover:bg-gray-700 text-white text-sm transition-colors"
            disabled={currentPath === '/'}
            title="Go Up"
          >
            <i className="fas fa-arrow-up"></i>
          </button>
          <span className="text-gray-300 px-2 py-1 bg-gray-700 rounded-md text-sm">{currentPath}</span>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            className="p-2 rounded-md bg-gray-700 border border-gray-600 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="New item name"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') createNewItem();
            }}
          />
          <select
            value={newItemType}
            onChange={(e) => setNewItemType(e.target.value)}
            className="p-2 rounded-md bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="folder">Folder</option>
            <option value="file">File</option>
          </select>
          <button
            onClick={createNewItem}
            className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Create
          </button>
        </div>
      </div>

      {message && <p className="text-green-400 text-sm p-2">{message}</p>}
      {errorMessage && <p className="text-red-500 text-sm p-2">{errorMessage}</p>}

      <div className="flex-grow p-4 overflow-auto grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
        {items.length === 0 ? (
          <p className="text-gray-400 col-span-full text-center mt-8">This folder is empty.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.name}
              className="flex flex-col items-center p-2 rounded-md hover:bg-gray-700 cursor-pointer transition-colors group"
              onDoubleClick={() => item.type === 'folder' ? navigateToFolder(item.name) : onOpenFile(item.name, currentPath)}
            >
              <div className="text-4xl mb-1">
                {item.type === 'folder' ? '📁' : '📄'}
              </div>
              <span className="text-xs text-center break-all">{item.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteItem(item.name, item.type); }}
                className="mt-1 px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FileExplorer;