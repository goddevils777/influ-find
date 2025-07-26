import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from './ProxyConnect.module.css';

interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'http' | 'https' | 'socks5';
}

const ProxyConnect: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [proxyForm, setProxyForm] = useState<ProxyConfig>({
    host: '',
    port: 8080,
    username: '',
    password: '',
    type: 'http'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProxyForm(prev => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) || 0 : value
    }));
  };

  const handleConnectProxy = async () => {
    if (!proxyForm.host || !proxyForm.port) {
      setError('Хост и порт обязательны для заполнения');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      const response = await axios.post<{
        success: boolean;
        message?: string;
      }>('http://localhost:3001/api/proxy/connect', proxyForm);
      
      if (response.data.success) {
        updateUser({ 
          proxyConnected: true
        });
        setError('');
      } else {
        setError(response.data.message || 'Ошибка подключения прокси');
      }
    } catch (error: any) {
      console.error('Proxy connection error:', error);
      setError(error.response?.data?.message || 'Ошибка подключения к прокси');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectProxy = async () => {
    try {
      const response = await axios.post<{
        success: boolean;
        message?: string;
      }>('http://localhost:3001/api/proxy/disconnect');
      
      if (response.data.success) {
        updateUser({ 
          proxyConnected: false
        });
        setProxyForm({
          host: '',
          port: 8080,
          username: '',
          password: '',
          type: 'http'
        });
      }
    } catch (error: any) {
      console.error('Proxy disconnect error:', error);
      setError('Ошибка отключения прокси');
    }
  };

  const testProxy = async () => {
    if (!proxyForm.host || !proxyForm.port) {
      setError('Введите хост и порт для тестирования');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      const response = await axios.post<{
        success: boolean;
        message?: string;
        ip?: string;
        country?: string;
      }>('http://localhost:3001/api/proxy/test', proxyForm);
      
      if (response.data.success) {
        setError(`✅ Прокси работает! IP: ${response.data.ip}, Страна: ${response.data.country}`);
      } else {
        setError(`❌ ${response.data.message || 'Прокси не работает'}`);
      }
    } catch (error: any) {
      setError(`❌ Ошибка тестирования: ${error.response?.data?.message || 'Неизвестная ошибка'}`);
    } finally {
      setConnecting(false);
    }
  };

  const testInstagram = async () => {
  setConnecting(true);
  setError('');

  try {
    const token = localStorage.getItem('token');
    const response = await axios.post<{
      success: boolean;
      message: string;
    }>('http://localhost:3001/api/proxy/test-instagram', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data.success) {
      setError(`✅ ${response.data.message}`);
    } else {
      setError(`❌ ${response.data.message}`);
    }
  } catch (error: any) {
    setError(`❌ ${error.response?.data?.message || 'Ошибка тестирования Instagram'}`);
  } finally {
    setConnecting(false);
  }
};

if (user?.proxyConnected) {
  return (
    <div className={styles.connectionCard}>
      <div className={styles.connectedHeader}>
        <div className={styles.statusIcon}>✅</div>
        <div>
          <h3>Прокси подключен</h3>
          <p>Безопасное подключение активно</p>
        </div>
      </div>
      
      {error && (
        <div className={`${styles.message} ${error.includes('✅') ? styles.success : styles.error}`}>
          {error}
        </div>
      )}
      
      <div className={styles.actions}>
        <button
          onClick={testInstagram}
          disabled={connecting}
          className={styles.testButton}
        >
          {connecting ? 'Тестируем...' : '🧪 Тест Instagram'}
        </button>
        
        <button
          onClick={handleDisconnectProxy}
          className={styles.disconnectButton}
        >
          Отключить прокси
        </button>
      </div>
    </div>
  );
}

  return (
    <div className={styles.connectionCard}>
      <div className={styles.disconnectedHeader}>
        <div className={styles.statusIcon}>🔒</div>
        <div>
          <h3>Прокси не подключен</h3>
          <p><strong>Обязательно</strong> для работы с Instagram</p>
        </div>
      </div>

      <div className={styles.proxyForm}>
        <div className={styles.formRow}>
          <div className={styles.inputGroup}>
            <label>Тип прокси</label>
            <select
              name="type"
              value={proxyForm.type}
              onChange={handleInputChange}
              className={styles.select}
            >
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>
          
          <div className={styles.inputGroup}>
            <label>Хост *</label>
            <input
              type="text"
              name="host"
              value={proxyForm.host}
              onChange={handleInputChange}
              placeholder="123.45.67.89"
              className={styles.input}
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label>Порт *</label>
            <input
              type="number"
              name="port"
              value={proxyForm.port || ''}
              onChange={handleInputChange}
              placeholder="8080"
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.inputGroup}>
            <label>Логин (если нужен)</label>
            <input
              type="text"
              name="username"
              value={proxyForm.username}
              onChange={handleInputChange}
              placeholder="proxy_user"
              className={styles.input}
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label>Пароль (если нужен)</label>
            <input
              type="password"
              name="password"
              value={proxyForm.password}
              onChange={handleInputChange}
              placeholder="proxy_password"
              className={styles.input}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className={`${styles.message} ${error.includes('✅') ? styles.success : styles.error}`}>
          {error}
        </div>
      )}

      <div className={styles.actions}>
        <button
          onClick={testProxy}
          disabled={connecting}
          className={styles.testButton}
        >
          {connecting ? 'Тестирование...' : '🔍 Тестировать прокси'}
        </button>
        
        <button
          onClick={handleConnectProxy}
          disabled={connecting}
          className={styles.connectButton}
        >
          {connecting ? (
            <>
              <div className={styles.spinner}></div>
              Подключение...
            </>
          ) : (
            '🔗 Подключить прокси'
          )}
        </button>
      </div>

      <div className={styles.instructions}>
        <h4>Где взять прокси:</h4>
        <ul>
          <li><strong>Платные:</strong> ProxyLine, BrightData, Smartproxy</li>
          <li><strong>Публичные:</strong> FreeProxy, ProxyList (менее надежные)</li>
          <li><strong>Формат:</strong> IP:PORT или IP:PORT:USER:PASS</li>
        </ul>
        <p><strong>⚠️ Без прокси подключение к Instagram заблокировано для безопасности</strong></p>
      </div>
    </div>
  );
};

export default ProxyConnect;