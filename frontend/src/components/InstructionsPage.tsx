import React from 'react';
import styles from './InstructionsPage.module.css';

interface InstructionsPageProps {
  onBackToHome: () => void;
}

const InstructionsPage: React.FC<InstructionsPageProps> = ({ onBackToHome }) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button 
          onClick={onBackToHome}
          className={styles.backButton}
        >
          ← Назад к поиску
        </button>
        <h1 className={styles.title}>📖 Инструкции по парсингу</h1>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h2>🔐 Подготовка аккаунтов Instagram</h2>
          
          <div className={styles.subsection}>
            <h3>Где купить аккаунты:</h3>
            <ul>
              <li>
                <strong><a href="https://dark.shopping/category/view/instagram" target="_blank" rel="noopener noreferrer">dark.shopping.com</a></strong> - проверенный магазин аккаунтов
              </li>
            </ul>
          </div>

          <div className={styles.warning}>
            ⚠️ <strong>Важно:</strong> Используйте только отдельные аккаунты для парсинга, не основные!
          </div>
        </div>

        <div className={styles.section}>
          <h2>⚡ Правила безопасного парсинга</h2>
          
          <div className={styles.rules}>
            <div className={styles.rule}>
              <span className={styles.ruleIcon}>🚫</span>
              <div>
                <strong>НЕ закрывайте браузер</strong>
                <p>Во время парсинга держите браузер открытым</p>
              </div>
            </div>
            
            <div className={styles.rule}>
              <span className={styles.ruleIcon}>📱</span>
              <div>
                <strong>НЕ переключайтесь между вкладками</strong>
                <p>Не открывайте другие сайты в том же браузере</p>
              </div>
            </div>
            
            <div className={styles.rule}>
              <span className={styles.ruleIcon}>💻</span>
              <div>
                <strong>Держите компьютер включенным</strong>
                <p>Не переводите в спящий режим</p>
              </div>
            </div>
            
            <div className={styles.rule}>
              <span className={styles.ruleIcon}>🎯</span>
              <div>
                <strong>Малыми порциями</strong>
                <p>Парсите 10-20 постов за раз, не больше</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <h2>🚨 Что делать при блокировке</h2>
          
          <ol className={styles.steps}>
            <li>Смените аккаунт Instagram на новый</li>
            <li>Очистите cookies браузера (Ctrl+Shift+Del)</li>
            <li>Подождите 2-4 часа перед новой попыткой</li>
          </ol>
        </div>

        <div className={styles.section}>
          <h2>✅ Рекомендации для успешной работы</h2>
          
          <ul>
            <li>Начинайте с 10-20 постов для тестирования</li>
            <li>Парсите в рабочее время (10:00-18:00)</li>
            <li>Делайте перерывы между сессиями (30-60 минут)</li>
          </ul>
        </div>

        <div className={styles.footer}>
          <button 
            onClick={onBackToHome}
            className={styles.startButton}
          >
            🚀 Начать парсинг
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstructionsPage;