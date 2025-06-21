// frontend/src/apps/ImageViewerApp.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNotifications } from '../components/NotificationSystem';

const SUPPORTED_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];

const ImageViewerApp = ({ filePath, fileName, token }) => {
  const { addNotification } = useNotifications();
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const loadImage = useCallback(async (path) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'}/api/cvfs/serve-file?path=${encodeURIComponent(path)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to load image.');
        } else {
          throw new Error('Failed to load image.');
        }
      }

      const imageBlob = await response.blob();
      if (!imageBlob.type.startsWith('image/')) {
        throw new Error('The file does not appear to be an image.');
      }

      const url = URL.createObjectURL(imageBlob);
      setImageUrl(url);
    } catch (err) {
      console.error("Error loading image:", err);
      setError(`Could not load image: ${err.message}`);
      addNotification(`Failed to load image: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [token, addNotification]);

  useEffect(() => {
    if (filePath && token) {
      loadImage(filePath);
    }

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [filePath, token, loadImage]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      addNotification('Please drop an image file.', 'error');
      return;
    }

    const extension = file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_FORMATS.includes(extension)) {
      addNotification(`Unsupported image format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`, 'error');
      return;
    }

    // Create object URL from dropped file
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setError('');
  }, [addNotification]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // If no file is loaded, show the prompt
  if (!filePath && !imageUrl) {
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
          <h3 className="text-xl font-semibold text-gray-300 mb-4">Open an Image</h3>
          <p className="text-gray-400 mb-6">
            Use the File Explorer to open an image file, or drag and drop an image here.
          </p>
          <div className={`border-2 border-dashed rounded-lg p-8 transition-colors duration-200
            ${dragOver ? 'border-blue-500 bg-blue-500 bg-opacity-10' : 'border-gray-700'}`}>
            <p className="text-gray-500">
              {dragOver ? 'Drop the image here' : 'Drag and drop an image file here'}
            </p>
          </div>
          <p className="text-gray-500 text-sm mt-4">
            Supported formats: {SUPPORTED_FORMATS.join(', ').toUpperCase()}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full items-center justify-center bg-gray-900 overflow-hidden p-4 relative">
      {fileName && (
        <div className="absolute top-0 left-0 right-0 bg-gray-800 bg-opacity-75 p-2 z-10">
          <h3 className="text-lg font-semibold text-gray-300 text-center">{fileName}</h3>
        </div>
      )}
      {/* Content area below title bar */}
      <div style={{marginTop: fileName ? 40 : 0, width: '100%', height: '100%', position: 'relative'}}>
        {loading && (
          <div className="absolute left-0 right-0 bg-gray-900 bg-opacity-75 flex items-center justify-center" style={{top: 0, bottom: 0, pointerEvents: 'auto', zIndex: 20}}>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        )}
        {error && (
          <div className="absolute left-0 right-0 bg-red-900 bg-opacity-75 p-4 rounded-lg flex items-center justify-center" style={{top: 0, bottom: 0, pointerEvents: 'auto', zIndex: 20}}>
            <p className="text-red-400">{error}</p>
          </div>
        )}
        {imageUrl && !loading && !error && (
          <img
            src={imageUrl}
            alt={fileName || 'Dropped image'}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            onError={() => {
              setError('Failed to display image. It might be corrupted or in an unsupported format.');
              addNotification('Failed to display image. It might be corrupted or in an unsupported format.', 'error');
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ImageViewerApp;