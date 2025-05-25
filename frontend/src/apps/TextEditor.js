import React, { useState } from 'react';

const TextEditor = ({ filePath, fileName, initialContent, token }) => {
  const [content, setContent] = useState(initialContent || '');
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (!filePath) {
      setSaveError('Editor not properly initialized: No file path.');
      return;
    }
    setSaveMessage('');
    setSaveError('');
    try {
      const response = await fetch('http://localhost:5000/api/vfs/file', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Include token
        },
        body: JSON.stringify({ path: filePath, content: content }),
      });

      const data = await response.json();
      if (response.ok) {
        setSaveMessage(data.message || 'File saved successfully!');
      } else {
        setSaveError(data.message || 'Failed to save file.');
      }
    } catch (error) {
      console.error("Error saving file:", error);
      setSaveError('Failed to connect to local server or save file.');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <span className="font-semibold text-sm text-gray-300">Editing: {fileName}</span>
        <button
          onClick={handleSave}
          className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Save
        </button>
      </div>
      {saveMessage && <p className="text-green-400 text-sm p-2">{saveMessage}</p>}
      {saveError && <p className="text-red-500 text-sm p-2">{saveError}</p>}
      <textarea
        className="flex-grow w-full p-4 bg-gray-900 text-white border-none outline-none resize-none font-mono text-sm"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start typing your file content here..."
      ></textarea>
    </div>
  );
};

export default TextEditor;