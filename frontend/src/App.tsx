import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthForm from './components/Auth/AuthForm';
import SearchForm from './components/SearchForm';
import InstagramConnect from './components/InstagramConnect/InstagramConnect';
import './App.css';
import ProxyConnect from './components/ProxyConnect/ProxyConnect';

const AppContent: React.FC = () => {
  const { user, loading, login, logout } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [activeTab, setActiveTab] = useState('search'); // 'search' или 'settings'

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  // Если пользователь не авторизован - показываем форму входа
  if (!user) {
    return (
      <AuthForm
        isLogin={isLogin}
        onSuccess={login}
        onToggleMode={() => setIsLogin(!isLogin)}
      />
    );
  }

  // Если авторизован - показываем основное приложение
  return (
    <div className="app-container">
      {/* Хедер с информацией о пользователе */}
      <header className="app-header">
        <div className="header-content">
          <h1>InfluFind</h1>
          
          {/* Навигация */}
          <nav className="header-nav">
            <button 
              className={`nav-button ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              🔍 Поиск
            </button>
            <button 
              className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              ⚙️ Настройки
            </button>
          </nav>

          <div className="user-info">
            <span>Привет, {user.name}!</span>
            <div className="connection-status">
              <span className={`status ${user.instagramConnected ? 'connected' : 'disconnected'}`}>
                Instagram: {user.instagramConnected ? 'Подключен' : 'Не подключен'}
              </span>
              <span className={`status ${user.proxyConnected ? 'connected' : 'disconnected'}`}>
                Прокси: {user.proxyConnected ? 'Подключен' : 'Не подключен'}
              </span>
            </div>
            <button onClick={logout} className="logout-button">
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Основное содержимое */}
      <main className="main-content">

      {activeTab === 'search' && (
        <>
          {/* Предупреждение если прокси или Instagram не подключены */}
          {!user.instagramConnected && (
            <div className="search-warning">
              ⚠️ Для парсинга необходимо: подключить аккаунт Instagram. Перейдите в <button 
                className="link-button" 
                onClick={() => setActiveTab('settings')}
              >
                Настройки
              </button>
            </div>
          )}
          
          <SearchForm />
        </>
      )}




      {activeTab === 'settings' && (
  <div className="settings-container">
    <h2>Настройки подключений</h2>
    
    <div className="settings-section">
      <h3>🔒 Прокси настройки</h3>
      <ProxyConnect />
    </div>

    <div className="settings-section">
      <h3>📱 Instagram аккаунт</h3>
      <InstagramConnect />
      
      <div style={{ 
        marginTop: '15px', 
        padding: '15px', 
        backgroundColor: '#e8f4fd', 
        border: '1px solid #bee5eb', 
        borderRadius: '6px',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#0c5460' }}>💡 Рекомендации для безопасного парсинга:</h4>
        <ul style={{ margin: '0', paddingLeft: '20px', color: '#0c5460' }}>
          <li><strong>Мобильные IP:</strong> При смене аккаунта используйте раздачу интернета с телефона</li>
          <li><strong>Смена IP:</strong> Включение/выключение режима полета даст новый IP адрес</li>
          <li><strong>Тип прокси:</strong> Используйте HTTP прокси вместо SOCKS5 для лучшей совместимости</li>
          <li><strong>Серверные прокси:</strong> Избегайте серверных прокси - Instagram быстро их блокирует</li>
        </ul>
      </div>
    </div>
  </div>
)}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;