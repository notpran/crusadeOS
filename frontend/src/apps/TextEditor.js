// frontend/src/apps/TextEditor.js
import React, { useState, useCallback, useEffect } from 'react';
import { useNotifications } from '../components/NotificationSystem';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

const TextEditor = ({ filePath, fileName, initialContent, token }) => {
  const { addNotification } = useNotifications();
  const [content, setContent] = useState(initialContent || '');
  const [isEdited, setIsEdited] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add beforeunload event listener to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isEdited) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEdited]);

  const handleSave = async () => {
    if (!filePath) {
      addNotification('Editor not properly initialized: No file path.', 'error');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/cvfs/file`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ path: filePath, content: content }),
      });

      const data = await response.json();
      if (response.ok) {
        setIsEdited(false);
        addNotification(data.message || 'File saved successfully!', 'success');
      } else {
        addNotification(data.message || 'Failed to save file.', 'error');
      }
    } catch (error) {
      console.error("Error saving file:", error);
      addNotification('Failed to connect to local server or save file.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = useCallback((e) => {
    setContent(e.target.value);
    setIsEdited(true);
  }, []);

  const handleKeyDown = useCallback((e) => {
    // Handle Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Handle tabs
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newContent = content.substring(0, start) + '    ' + content.substring(end);
      setContent(newContent);
      setIsEdited(true);
      // Move cursor after tab
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 4;
      }, 0);
    }
  }, [content, handleSave]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (isEdited) {
      const confirmDrop = window.confirm('You have unsaved changes. Do you want to discard them and open the new file?');
      if (!confirmDrop) return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setContent(event.target.result);
      setIsEdited(true);
      addNotification('File loaded successfully! Remember to save your changes.', 'success');
    };
    reader.onerror = () => {
      addNotification('Failed to read the dropped file.', 'error');
    };
    reader.readAsText(file);
  }, [isEdited, addNotification]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // If no file is loaded, show the prompt
  if (!filePath && !content) {
    return (
      <div 
        className={`flex flex-col h-full items-center justify-center bg-gray-900 p-8 text-center
          ${dragOver ? 'bg-opacity-75' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className={`bg-gray-800 p-8 rounded-lg shadow-xl max-w-md transition-all duration-200
          ${dragOver ? 'scale-105 border-2 border-dashed border-blue-500' : ''}`}>
          <h3 className="text-xl font-semibold text-gray-300 mb-4">Open a Text File</h3>
          <p className="text-gray-400 mb-6">
            Use the File Explorer to open a text file, or drag and drop a file here.
          </p>
          <div className={`border-2 border-dashed rounded-lg p-8 transition-colors duration-200
            ${dragOver ? 'border-blue-500 bg-blue-500 bg-opacity-10' : 'border-gray-700'}`}>
            <p className="text-gray-500">
              {dragOver ? 'Drop the text file here' : 'Drag and drop a text file here'}
            </p>
          </div>
          <div className="mt-6 text-gray-400 text-sm">
            <p className="mb-2">Keyboard shortcuts:</p>
            <ul className="text-gray-500">
              <li>Save: Ctrl/Cmd + S</li>
              <li>Indent: Tab</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center">
          <span className="font-semibold text-sm text-gray-300">
            {fileName || 'Untitled'}{isEdited ? ' •' : ''}
          </span>
          {isEdited && (
            <span className="ml-2 text-xs text-gray-500">(unsaved changes)</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!isEdited || saving}
          className={`p-2 rounded-md text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
            ${isEdited && !saving ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 cursor-not-allowed'}`}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <textarea
        className="flex-grow w-full p-4 bg-gray-900 text-white border-none outline-none resize-none font-mono text-sm"
        value={content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        placeholder="Start typing..."
        spellCheck={false}
        disabled={saving}
      />
    </div>
  );
};

export default TextEditor;