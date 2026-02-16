import { useState, useEffect, createContext, useContext } from 'react';
import { apiClient } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const userStr = localStorage.getItem('user');
    if (userStr) {
        setUser(JSON.parse(userStr));
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
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    return { 
        user, 
        isAuthenticated: !!user,
        logout: () => {
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }; 
};
