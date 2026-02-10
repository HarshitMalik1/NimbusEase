import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, CheckCircle, Shield, Lock } from 'lucide-react';
import { apiClient } from '../services/api';
import CryptoJS from 'crypto-js';

const FileManagement = () => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [verificationResults, setVerificationResults] = useState({});

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const response = await apiClient.get('/storage/files');
      setFiles(response.data.files);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);

      // Client-side encryption
      const key = CryptoJS.lib.WordArray.random(32);
      const encrypted = CryptoJS.AES.encrypt(wordArray, key).toString();

      // Convert to File object
      const encryptedBlob = new Blob([encrypted], { type: file.type });
      
      const formData = new FormData();
      formData.append('file', encryptedBlob, file.name);
      formData.append('encryptionKey', key.toString());

      const response = await apiClient.post('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Save encryption key (in production, use secure key management)
      localStorage.setItem(`key_${response.data.fileId}`, key.toString());

      alert('File uploaded successfully with blockchain verification!');
      loadFiles();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const key = localStorage.getItem(`key_${fileId}`);
      if (!key) {
        alert('Encryption key not found. Please enter it manually.');
        return;
      }

      const response = await apiClient.post(`/storage/download/${fileId}`, {
        decryptionKey: key,
      }, {
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (response.headers['x-integrity-verified'] === 'true') {
        alert('✓ File integrity verified on blockchain');
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed or integrity check failed');
    }
  };

  const verifyFileIntegrity = async (fileId) => {
    try {
      const response = await apiClient.get(`/storage/verify/${fileId}`);
      setVerificationResults(prev => ({
        ...prev,
        [fileId]: response.data,
      }));
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await apiClient.delete(`/storage/files/${fileId}`);
      loadFiles();
      alert('File deleted successfully');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Upload File</h2>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4">
              <label className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-gray-900">
                  {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Files are encrypted client-side with AES-256
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Your Files</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {files.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No files uploaded yet
            </div>
          ) : (
            files.map(file => (
              <div key={file.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <Lock className="h-5 w-5 text-green-600" />
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {file.fileName}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)} MB • 
                          Uploaded {new Date(file.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {verificationResults[file.id] && (
                      <div className={`mt-2 p-2 rounded text-xs ${
                        verificationResults[file.id].integrityValid
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {verificationResults[file.id].integrityValid
                          ? '✓ Blockchain integrity verified'
                          : '✗ Integrity check failed - file may be tampered'
                        }
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => verifyFileIntegrity(file.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Verify on Blockchain"
                    >
                      <Shield className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDownload(file.id, file.fileName)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                      title="Download"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                {file.blockchainTxHash && (
                  <div className="mt-2 text-xs text-gray-500 font-mono">
                    Blockchain TX: {file.blockchainTxHash.substring(0, 20)}...
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FileManagement;