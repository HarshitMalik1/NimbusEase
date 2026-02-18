import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api';
import { Shield, FileText, Users, Upload, Download, Activity, Lock, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const { user, isAdmin, logout } = useAuth();
  const [files, setFiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState({ status: 'SECURE', anomalyScore: 0.02, alerts: 0 });
  const [loading, setLoading] = useState(true);
  
  // Upload States
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);

  useEffect(() => {
    fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const fileRes = await apiClient.get('/storage/list');
      setFiles(fileRes.data.files || []);

      if (isAdmin) {
        const userRes = await apiClient.get('/admin/users');
        setUsers(userRes.data || []);
        
        const healthRes = await apiClient.get('/security/dashboard');
        setHealth(healthRes.data || health);
      }
    } catch (err) {
      console.error("Data fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setUploading(true);
      const res = await apiClient.post('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Backend returns { fileId, encryptionKey, ... }
      setGeneratedKey(res.data.encryptionKey);
      fetchData(); // Refresh list
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId, fileName) => {
    const key = prompt(`Enter the AES Decryption Key for [${fileName}]:`);
    if (!key) return;

    try {
      const response = await apiClient.get(`/storage/download/${fileId}`, {
        params: { key },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Decryption failed. The key might be incorrect or the file was tampered with.");
    }
  };

  return (
    <div className="container-fluid min-vh-100 p-4">
      {/* Navbar */}
      <nav className="d-flex justify-content-between align-items-center mb-5 pb-3 border-bottom border-dark">
        <h2 className="Orbitron neon-text m-0">NIMBUSEASE <small className="fs-6 text-white-50">v1.0</small></h2>
        <div className="d-flex align-items-center gap-4">
          <span className="text-white-50">ACCESS_ID: <span className="text-white">{user?.email}</span></span>
          <button onClick={logout} className="btn neon-btn">Terminate_Session</button>
        </div>
      </nav>

      <div className="row g-4">
        {/* Left Column: Stats & Health */}
        <div className="col-lg-4">
          {/* Security Health (Admin Only) */}
          {isAdmin ? (
            <div className="glass-card neon-border p-4 mb-4">
              <div className="d-flex align-items-center mb-4">
                <Shield className="neon-text me-3" size={32} />
                <h4 className="m-0 Orbitron">SECURITY_HEALTH</h4>
              </div>
              <div className="text-center py-3">
                <div className={`display-4 fw-bold mb-2 ${health.status === 'SECURE' ? 'text-success' : 'text-danger'}`} style={{textShadow: '0 0 10px currentColor'}}>
                  {health.status}
                </div>
                <div className="progress bg-dark mb-3" style={{height: '10px'}}>
                  <div className="progress-bar bg-info" style={{width: `${(1 - health.anomalyScore) * 100}%`, boxShadow: '0 0 10px #0dcaf0'}}></div>
                </div>
                <div className="d-flex justify-content-between text-white-50 small">
                  <span>ANOMALY_SCORE: {health.anomalyScore}</span>
                  <span>ACTIVE_ALERTS: {health.alerts}</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-top border-dark">
                <div className="d-flex align-items-center gap-2 text-warning mb-2">
                  <Activity size={16} /> <span>Neural Network: ACTIVE</span>
                </div>
                <div className="d-flex align-items-center gap-2 text-info">
                  <Lock size={16} /> <span>Blockchain Ledger: SYNCHRONIZED</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card neon-border p-4 mb-4 text-center">
              <Lock className="neon-text mb-3" size={48} />
              <h4 className="Orbitron mb-3">SECURE_VAULT</h4>
              <p className="text-white-50">Your files are encrypted with AES-256 and verified via Hyperledger Blockchain.</p>
            </div>
          )}

          {/* User Directory (Admin Only) */}
          {isAdmin && (
            <div className="glass-card border border-dark p-4">
              <div className="d-flex align-items-center mb-4">
                <Users className="text-info me-3" size={24} />
                <h5 className="m-0 Orbitron">USER_DIRECTORY</h5>
              </div>
              <div className="list-group list-group-flush bg-transparent">
                {users.map(u => (
                  <div key={u.id} className="list-group-item bg-transparent text-white border-dark px-0 py-3">
                    <div className="fw-bold">{u.fullName}</div>
                    <div className="small text-white-50">{u.email}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Files & Actions */}
        <div className="col-lg-8">
          <div className="glass-card neon-border p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div className="d-flex align-items-center">
                <FileText className="neon-text me-3" size={32} />
                <h4 className="m-0 Orbitron">{isAdmin ? 'GLOBAL_FILE_INDEX' : 'MY_FILES'}</h4>
              </div>
              <div className="d-flex gap-2">
                <button className="btn neon-btn d-flex align-items-center gap-2" data-bs-toggle="modal" data-bs-target="#uploadModal">
                  <Upload size={18} /> UPLOAD
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle border-dark">
                <thead>
                  <tr className="text-white-50 small Orbitron">
                    <th>FILE_NAME</th>
                    <th>SIZE</th>
                    <th>UPLOADED_AT</th>
                    {isAdmin && <th>OWNER</th>}
                    <th className="text-end">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="text-center py-5 text-white-50 italic">No records found in current sector.</td>
                    </tr>
                  ) : (
                    files.map(file => (
                      <tr key={file.id}>
                        <td>{file.fileName}</td>
                        <td className="text-white-50">{Math.round(file.size / 1024)} KB</td>
                        <td className="text-white-50 small">{new Date(file.createdAt).toLocaleDateString()}</td>
                        {isAdmin && <td>{file.userId}</td>}
                        <td className="text-end">
                          <button 
                            className="btn btn-sm btn-outline-info me-2 p-1" 
                            title="Download"
                            onClick={() => handleDownload(file.id, file.fileName)}
                          >
                            <Download size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <div className="modal fade" id="uploadModal" tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content glass-card neon-border text-white">
            <div className="modal-header border-dark">
              <h5 className="modal-title Orbitron neon-text">INITIATE_UPLOAD</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" onClick={() => {setGeneratedKey(null); setSelectedFile(null);}}></button>
            </div>
            <div className="modal-body p-4">
              {!generatedKey ? (
                <>
                  <div className="mb-4 text-center p-5 border border-dashed border-dark rounded position-relative">
                    <Upload size={48} className={`${selectedFile ? 'neon-text' : 'text-white-50'} mb-3`} />
                    <p>{selectedFile ? selectedFile.name : 'Select data payload for encryption'}</p>
                    <input 
                      type="file" 
                      className="form-control position-absolute top-0 start-0 w-100 h-100 opacity-0 cursor-pointer" 
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                    />
                  </div>
                  <button 
                    className="btn neon-btn w-100" 
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? 'ENCRYPTING & UPLOADING...' : 'EXECUTE_UPLOAD'}
                  </button>
                </>
              ) : (
                <div className="text-center animate-in">
                  <Lock className="text-warning mb-3" size={48} />
                  <h5 className="Orbitron text-warning mb-3">ENCRYPTION_COMPLETE</h5>
                  <p className="small text-white-50">Save this key. It is required for decryption and cannot be recovered.</p>
                  
                  <div className="bg-black p-3 border border-warning rounded mb-4">
                    <code className="text-warning fw-bold break-all" style={{wordBreak: 'break-all'}}>{generatedKey}</code>
                  </div>
                  
                  <button 
                    className="btn btn-outline-warning w-100 Orbitron small"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                      alert("Key copied to secure clipboard.");
                    }}
                  >
                    COPY_TO_CLIPBOARD
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
