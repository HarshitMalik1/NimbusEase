import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/api';
import { Lock, Mail, ShieldAlert } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('auth/login', { email, password });
      login(res.data.user);
      navigate('/dashboard');
    } catch (err) {
      console.error("FULL_AUTH_ERROR:", err);
      if (err.response) {
        console.error("SERVER_RESPONSE_DATA:", err.response.data);
        setError(err.response.data.message || 'Access Denied: Server error.');
      } else if (err.request) {
        console.error("NO_RESPONSE_RECEIVED. Is backend running on 3002?");
        setError('Cannot connect to security node. Check backend status.');
      } else {
        setError('Authentication request failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container min-vh-100 d-flex align-items-center justify-content-center">
      <div className="col-md-5">
        <div className="text-center mb-5">
          <ShieldAlert className="neon-text mb-3" size={64} />
          <h1 className="Orbitron neon-text">NIMBUSEASE</h1>
          <p className="text-white-50 tracking-widest">QUANTUM_ENCRYPTION_VAULT</p>
        </div>
        
        <div className="glass-card neon-border p-5">
          <h4 className="Orbitron text-center mb-4">IDENTIFICATION_REQUIRED</h4>
          
          {error && <div className="alert bg-danger text-white border-0 small mb-4">{error}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <div className="d-flex align-items-center mb-2 text-white-50 small">
                <Mail size={14} className="me-2" /> USER_EMAIL
              </div>
              <input 
                type="email" 
                className="form-control bg-dark border-dark text-white p-3" 
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="mb-5">
              <div className="d-flex align-items-center mb-2 text-white-50 small">
                <Lock size={14} className="me-2" /> ACCESS_CREDENTIAL
              </div>
              <input 
                type="password" 
                className="form-control bg-dark border-dark text-white p-3" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button type="submit" className="btn neon-btn w-100 py-3 mb-3" disabled={loading}>
              {loading ? 'VERIFYING...' : 'INITIATE_AUTH'}
            </button>
            
            <div className="text-center mt-3 d-flex flex-column gap-2">
              <a href="/signup" className="text-info small text-decoration-none Orbitron">NEW_IDENTITY_REGISTRATION</a>
              <a href="#" className="text-white-50 small text-decoration-none hover:text-info">Request access credentials</a>
            </div>
          </form>
        </div>
        
        <div className="text-center mt-4 text-white-50 small">
          SECURE_NODE: 172.16.254.1 | SYSTEM_STATUS: <span className="text-success">NOMINAL</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
