import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from './InstagramConnect.module.css';

const InstagramConnect: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

const handleConnectInstagram = async () => {
  setConnecting(true);
  setError('');

  try {
    // ДОБАВЛЯЕМ ТИПИЗАЦИЮ ДЛЯ ОТВЕТА:
    const response = await axios.post<{
      success: boolean;
      message?: string;
      username?: string;
      status?: string;
    }>('http://localhost:3001/api/instagram/connect');
    
    if (response.data.success) {
      // Обновляем статус пользователя
      updateUser({ 
        instagramConnected: true,
        instagramUsername: response.data.username 
      });
    } else {
      setError(response.data.message || 'Ошибка подключения Instagram');
    }
  } catch (error: any) {
    console.error('Instagram connection error:', error);
    setError(error.response?.data?.message || 'Ошибка подключения к Instagram');
  } finally {
    setConnecting(false);
  }
};

const handleDisconnectInstagram = async () => {
  try {
    const response = await axios.post<{
      success: boolean;
      message?: string;
    }>('http://localhost:3001/api/instagram/disconnect');
    
    if (response.data.success) {
      updateUser({ 
        instagramConnected: false,
        instagramUsername: undefined 
      });
    }
  } catch (error: any) {
    console.error('Instagram disconnect error:', error);
    setError('Ошибка отключения Instagram');
  }
};

  if (user?.instagramConnected) {
    return (
      <div className={styles.connectionCard}>
        <div className={styles.connectedHeader}>
          <div className={styles.statusIcon}>✅</div>
          <div>
            <h3>Instagram подключен</h3>
            <p>Аккаунт готов для парсинга</p>
          </div>
        </div>
        
        <div className={styles.actions}>
          <button
            onClick={handleDisconnectInstagram}
            className={styles.disconnectButton}
          >
            Отключить аккаунт
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.connectionCard}>
      <div className={styles.disconnectedHeader}>
        <div className={styles.statusIcon}>❌</div>
        <div>
          <h3>Instagram не подключен</h3>
          <p>Подключите аккаунт для начала парсинга</p>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.actions}>
        <button
          onClick={handleConnectInstagram}
          disabled={connecting}
          className={styles.connectButton}
        >
          {connecting ? (
            <>
              <div className={styles.spinner}></div>
              Подключение...
            </>
          ) : (
            '🔗 Подключить Instagram'
          )}
        </button>
      </div>

      <div className={styles.instructions}>
        <h4>Как это работает:</h4>
        <ol>
          <li>Нажмите "Подключить Instagram"</li>
          <li>Откроется браузер с формой входа Instagram</li>
          <li>Войдите в свой аккаунт</li>
          <li>Вернитесь в приложение - аккаунт будет подключен</li>
        </ol>
      </div>
    </div>
  );
};

export default InstagramConnect;