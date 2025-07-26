import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  type: 'http' | 'https' | 'socks5';
}

interface ProxyStatusResponse {
  success: boolean;
  connected: boolean;
  config?: {
    host: string;
    port: number;
    type: string;
    hasAuth: boolean;
  };
}

interface InstagramStatusResponse {
  success: boolean;
  connected: boolean;
  username?: string;
}

interface ProxyConnectResponse {
  success: boolean;
  message: string;
  ip?: string;
  country?: string;
}

interface InstagramTestResponse {
  success: boolean;
  message: string;
  details?: any;
}

interface InstagramConnectResponse {
  success: boolean;
  message: string;
  status?: string;
}

const Settings: React.FC = () => {
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    host: '',
    port: 0,
    username: '',
    password: '',
    type: 'socks5'
  });
  
  const [proxyConnected, setProxyConnected] = useState(false);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [testingInstagram, setTestingInstagram] = useState(false);

  // Загрузка статуса при монтировании
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Проверяем статус прокси
      const proxyResponse = await axios.get<ProxyStatusResponse>('http://localhost:3001/api/proxy/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (proxyResponse.data.success) {
        setProxyConnected(proxyResponse.data.connected);
        if (proxyResponse.data.config) {
          setProxyConfig(prev => ({
            ...prev,
            host: proxyResponse.data.config!.host,
            port: proxyResponse.data.config!.port,
            type: proxyResponse.data.config!.type as 'http' | 'https' | 'socks5'
          }));
        }
      }

      // Проверяем статус Instagram
      const instagramResponse = await axios.get<InstagramStatusResponse>('http://localhost:3001/api/instagram/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (instagramResponse.data.success) {
        setInstagramConnected(instagramResponse.data.connected);
      }

    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const handleProxyConnect = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post<ProxyConnectResponse>('http://localhost:3001/api/proxy/connect', proxyConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setProxyConnected(true);
        setMessage(`✅ Прокси подключен! IP: ${response.data.ip}, Страна: ${response.data.country}`);
      }
    } catch (error: any) {
        const errorData = error.response?.data;
        
        if (errorData?.error === 'proxy_blocked') {
            setMessage(`❌ ${errorData.message}\n\n📋 Рекомендации:\n${errorData.recommendations?.join('\n') || ''}`);
        } else {
            setMessage(`❌ ${errorData?.message || 'Ошибка подключения Instagram'}`);
        }
        } finally {
      setLoading(false);
    }
  };

  const handleProxyDisconnect = async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3001/api/proxy/disconnect', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProxyConnected(false);
      setInstagramConnected(false);
      setMessage('✅ Прокси отключен');
    } catch (error: any) {
      setMessage(`❌ ${error.response?.data?.message || 'Ошибка отключения прокси'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestInstagram = async () => {
    setTestingInstagram(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post<InstagramTestResponse>('http://localhost:3001/api/proxy/test-instagram', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setMessage(`✅ ${response.data.message}`);
      } else {
        setMessage(`❌ ${response.data.message}`);
      }
    } catch (error: any) {
      setMessage(`❌ ${error.response?.data?.message || 'Ошибка тестирования Instagram'}`);
    } finally {
      setTestingInstagram(false);
    }
  };

  const handleInstagramConnect = async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post<InstagramConnectResponse>('http://localhost:3001/api/instagram/connect', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setMessage('✅ Браузер открыт для авторизации Instagram. Войдите в аккаунт в браузере.');
        // Через некоторое время проверяем статус
        setTimeout(() => {
          loadStatus();
        }, 5000);
      }
    } catch (error: any) {
      setMessage(`❌ ${error.response?.data?.message || 'Ошибка подключения Instagram'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h2>Настройки</h2>
      
      {/* Настройки прокси */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h3>🔗 Прокси сервер</h3>
        <p>Статус: {proxyConnected ? '✅ Подключен' : '❌ Не подключен'}</p>
        
        {!proxyConnected && (
          <div>
            <div style={{ marginBottom: '10px' }}>
              <label>Хост:</label>
              <input
                type="text"
                value={proxyConfig.host}
                onChange={(e) => setProxyConfig(prev => ({ ...prev, host: e.target.value }))}
                placeholder="91.247.166.24"
                style={{ marginLeft: '10px', padding: '5px', width: '200px' }}
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label>Порт:</label>
              <input
                type="number"
                value={proxyConfig.port || ''}
                onChange={(e) => setProxyConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 0 }))}
                placeholder="64963"
                style={{ marginLeft: '10px', padding: '5px', width: '100px' }}
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label>Тип:</label>
              <select
                value={proxyConfig.type}
                onChange={(e) => setProxyConfig(prev => ({ ...prev, type: e.target.value as any }))}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                <option value="socks5">SOCKS5</option>
                <option value="http">HTTP</option>
                <option value="https">HTTPS</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label>Логин:</label>
              <input
                type="text"
                value={proxyConfig.username}
                onChange={(e) => setProxyConfig(prev => ({ ...prev, username: e.target.value }))}
                style={{ marginLeft: '10px', padding: '5px', width: '150px' }}
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label>Пароль:</label>
              <input
                type="password"
                value={proxyConfig.password}
                onChange={(e) => setProxyConfig(prev => ({ ...prev, password: e.target.value }))}
                style={{ marginLeft: '10px', padding: '5px', width: '150px' }}
              />
            </div>
            
            <button
              onClick={handleProxyConnect}
              disabled={loading || !proxyConfig.host || !proxyConfig.port}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Подключение...' : 'Подключить прокси'}
            </button>
          </div>
        )}
        
        {proxyConnected && (
          <div>
            <p>Прокси: {proxyConfig.host}:{proxyConfig.port} ({proxyConfig.type})</p>
            <button
              onClick={handleProxyDisconnect}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              Отключить прокси
            </button>
            
            <button
              onClick={handleTestInstagram}
              disabled={testingInstagram}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {testingInstagram ? 'Тестируем...' : '🧪 Тест Instagram'}
            </button>
          </div>
        )}
      </div>
      
     {/* Настройки Instagram */}
<div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
  <h3>📸 Instagram аккаунт</h3>
  <p>Статус: {instagramConnected ? '✅ Подключен' : '❌ Не подключен'}</p>
  
  {!instagramConnected && (
    <button
      onClick={handleInstagramConnect}
      disabled={loading}
      style={{
        padding: '10px 20px',
        backgroundColor: '#E4405F',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      {loading ? 'Подключение...' : 'Подключить Instagram'}
    </button>
  )}
  
  {proxyConnected && (
    <p style={{ color: '#28a745', fontSize: '14px', marginTop: '10px' }}>
      ✅ Используется прокси для дополнительной безопасности
    </p>
  )}
  
  {!proxyConnected && (
    <p style={{ color: '#ffc107', fontSize: '14px', marginTop: '10px' }}>
      💡 Рекомендуется использовать прокси для безопасности при парсинге
    </p>
  )}
</div>
      
      {/* Сообщения */}
      {message && (
        <div style={{
          padding: '10px',
          margin: '10px 0',
          backgroundColor: message.includes('❌') ? '#f8d7da' : '#d4edda',
          border: `1px solid ${message.includes('❌') ? '#f5c6cb' : '#c3e6cb'}`,
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default Settings;