import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

// Найди интерфейс User и обнови:
interface User {
  userId: string;
  email: string;
  name: string;
  instagramConnected: boolean;
  instagramUsername?: string; // ДОБАВЬ ЭТУ СТРОКУ
  proxyConnected: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Проверка токена при загрузке приложения
// Найди useEffect с initAuth и исправь axios запрос:
useEffect(() => {
  const initAuth = async () => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (savedToken && savedUser) {
      try {
        // ДОБАВЛЯЕМ ТИПИЗАЦИЮ:
        const response = await axios.get<{
          success: boolean;
          user: User;
        }>('http://localhost:3001/api/auth/me', {
          headers: {
            Authorization: `Bearer ${savedToken}`
          }
        });

        if (response.data.success) {
          setToken(savedToken);
          setUser(response.data.user);
          
          // Настраиваем axios для автоматической отправки токена
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        } else {
          // Токен недействителен
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
    setLoading(false);
  };

  initAuth();
}, []);

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Настраиваем axios для автоматической отправки токена
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Убираем токен из axios
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

const checkAuth = async (): Promise<boolean> => {
  if (!token) return false;

  try {
    const response = await axios.get<{
      success: boolean;
    }>('http://localhost:3001/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data.success;
  } catch (error) {
    return false;
  }
};

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook для использования контекста
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};