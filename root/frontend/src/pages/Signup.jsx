import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { UserPlus, Mail, Lock, User, ShieldCheck } from 'lucide-react';

const Signup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialRole = queryParams.get('role')?.toUpperCase() || 'USER';

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: initialRole
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient.post('auth/register', formData);
      navigate('/login?success=registered');
    } catch (err) {
      console.error("REGISTRATION_ERROR:", err);
      if (err.response) {
        // Backend responded with an error (e.g., 400 Bad Request)
        const msg = err.response.data.message;
        setError(Array.isArray(msg) ? msg.join(' | ') : msg);
      } else if (err.request) {
        // Request was made but no response (Connection Error)
        setError('CRITICAL: Cannot connect to Security Node. Is backend running on 3006?');
      } else {
        setError('An unexpected error occurred during identity creation.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container min-vh-100 d-flex align-items-center justify-content-center">
      <div className="col-md-5">
        <div className="text-center mb-4">
          <UserPlus className="neon-text mb-2" size={48} />
          <h2 className="Orbitron neon-text">CREATE_IDENTITY</h2>
        </div>

        <div className="glass-card neon-border p-5">
          {error && <div className="alert bg-danger text-white border-0 small mb-4">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <div className="d-flex align-items-center mb-2 text-white-50 small">
                <User size={14} className="me-2" /> FULL_NAME
              </div>
              <input 
                type="text" 
                className="form-control bg-dark border-dark text-white" 
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                required
              />
            </div>

            <div className="mb-3">
              <div className="d-flex align-items-center mb-2 text-white-50 small">
                <Mail size={14} className="me-2" /> EMAIL_ADDRESS
              </div>
              <input 
                type="email" 
                className="form-control bg-dark border-dark text-white" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>

            <div className="mb-4">
              <div className="d-flex align-items-center mb-2 text-white-50 small">
                <Lock size={14} className="me-2" /> ACCESS_CREDENTIAL
              </div>
              <input 
                type="password" 
                className="form-control bg-dark border-dark text-white" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>

            <div className="mb-4">
              <div className="d-flex align-items-center mb-2 text-white-50 small">
                <ShieldCheck size={14} className="me-2" /> ASSIGNED_ROLE
              </div>
              <select 
                className="form-select bg-dark border-dark text-white"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
              >
                <option value="USER">USER_NODE</option>
                <option value="ADMIN">ADMIN_CORE</option>
              </select>
            </div>

            <button type="submit" className="btn neon-btn w-100 py-3 mb-3" disabled={loading}>
              {loading ? 'PROCESSING...' : 'REGISTER_IDENTITY'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-white-50 small text-decoration-none hover:text-info">
                Already registered? Proceed to LOGIN
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
