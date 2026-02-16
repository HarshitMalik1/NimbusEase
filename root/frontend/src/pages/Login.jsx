import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';

const AuthPage = () => {
  const [step, setStep] = useState('check'); // 'check', 'login', 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCheckEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/check-email', { email });
      if (response.data.exists) {
        setStep('login');
      } else {
        setStep('signup');
      }
    } catch (err) {
      setError('Error checking email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.post('/auth/register', { fullName, email, password });
      // After signup, automatically log them in
      const loginRes = await apiClient.post('/auth/login', { email, password });
      if (loginRes.data.user) {
        localStorage.setItem('user', JSON.stringify(loginRes.data.user));
        navigate('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card shadow border-0">
            <div className="card-body p-4">
              <h3 className="text-center mb-4">
                {step === 'check' && 'Welcome'}
                {step === 'login' && 'Login'}
                {step === 'signup' && 'Create Account'}
              </h3>

              {error && <div className="alert alert-danger">{error}</div>}

              {step === 'check' && (
                <form onSubmit={handleCheckEmail}>
                  <div className="mb-3">
                    <label className="form-label">Enter your email to get started</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
                    {loading ? 'Checking...' : 'Continue'}
                  </button>
                </form>
              )}

              {step === 'login' && (
                <form onSubmit={handleLogin}>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={email} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-100 py-2" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                  </button>
                  <button type="button" className="btn btn-link w-100 mt-2" onClick={() => setStep('check')}>
                    Back
                  </button>
                </form>
              )}

              {step === 'signup' && (
                <form onSubmit={handleSignup}>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={email} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password (min 8 chars, 1 uppercase, 1 digit)</label>
                    <input
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-success w-100 py-2" disabled={loading}>
                    {loading ? 'Creating account...' : 'Sign Up'}
                  </button>
                  <button type="button" className="btn btn-link w-100 mt-2" onClick={() => setStep('check')}>
                    Back
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
