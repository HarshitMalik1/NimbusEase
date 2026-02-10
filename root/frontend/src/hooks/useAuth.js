import { useState, useEffect, createContext, useContext } from 'react';
import { apiClient } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in (e.g. token exists)
    // For now, mock it or decode token
    const token = localStorage.getItem('token');
    if (token) {
        setUser({ name: 'Test User', role: 'ADMIN' }); // Mock
    }
  }, []);

  const login = async (email, password) => {
      // Call API
      // const res = await apiClient.post('/auth/login', { email, password });
      // localStorage.setItem('token', res.data.accessToken);
      // setUser(res.data.user);
      console.log('Login mock');
  };

  return (
    <AuthContext.Provider value={{ user, login }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
    // Return a mock user for now to ensure Dashboard renders
    return { user: { name: 'Demo User', role: 'admin' } }; 
    // In real app: return useContext(AuthContext);
};
