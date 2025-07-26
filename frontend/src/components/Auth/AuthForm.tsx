import React, { useState } from 'react';
import axios from 'axios';
import styles from './AuthForm.module.css';

interface AuthFormProps {
  isLogin: boolean;
  onSuccess: (token: string, user: any) => void;
  onToggleMode: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ isLogin, onSuccess, onToggleMode }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

// Найди функцию handleSubmit и замени на эту версию:
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  try {
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { email: formData.email, password: formData.password }
      : formData;

    // ДОБАВЛЯЕМ ТИПИЗАЦИЮ ДЛЯ ОТВЕТА:
    const response = await axios.post<{
      success: boolean;
      message: string;
      token?: string;
      user?: any;
    }>(`http://localhost:3001${endpoint}`, payload);

    if (response.data.success) {
      localStorage.setItem('token', response.data.token || '');
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      onSuccess(response.data.token || '', response.data.user);
    }
  } catch (error: any) {
    setError(error.response?.data?.message || 'Произошла ошибка');
  } finally {
    setLoading(false);
  }
};

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <h2 className={styles.title}>
          {isLogin ? 'Вход в InfluFind' : 'Регистрация в InfluFind'}
        </h2>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          {!isLogin && (
            <div className={styles.inputGroup}>
              <label htmlFor="name">Имя</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required={!isLogin}
                placeholder="Введите ваше имя"
              />
            </div>
          )}
          
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Введите email"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Введите пароль"
              minLength={6}
            />
          </div>
          
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>
        
        <div className={styles.toggleMode}>
          {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
          <button 
            type="button" 
            onClick={onToggleMode}
            className={styles.toggleButton}
          >
            {isLogin ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;