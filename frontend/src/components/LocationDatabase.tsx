import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface DatabaseStats {
  countries: number;
  cities: number;
  locations: number;
  files: string[];
}

interface City {
  id: string;
  name: string;
  file: string;
}

const LocationDatabase: React.FC = () => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [parsingStats, setParsingStats] = useState<any>(null);
  const [resuming, setResuming] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/locations/database/stats');
      setStats((response.data as any).stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchCities = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/locations/cities/available');
      setCities((response.data as any).cities);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const fetchParsingStats = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/locations/parsing/stats');
      setParsingStats((response.data as any).stats);
    } catch (error) {
      console.error('Error fetching parsing stats:', error);
    }
  };

  const createDatabase = async (option: string) => {
    setCreating(option);
    try {
      const response = await axios.post('http://localhost:3001/api/locations/database/create', {
        option
      });
      
      if ((response.data as any).success) {
        alert(`Создание базы для ${option} запущено! Проверяйте логи backend.`);
        
        // Обновляем статистику каждые 10 секунд
        const interval = setInterval(() => {
          fetchStats();
          fetchCities();
          fetchParsingStats();
        }, 10000);
        
        // Останавливаем обновление через 5 минут
        setTimeout(() => {
          clearInterval(interval);
          setCreating(null);
        }, 300000);
      }
    } catch (error) {
      console.error('Error creating database:', error);
      alert('Ошибка создания базы данных');
      setCreating(null);
    }
  };

  const resumeParsing = async () => {
    setResuming(true);
    try {
      const response = await axios.post('http://localhost:3001/api/locations/parsing/resume', {
        country: 'ukraine'
      });
      
      if ((response.data as any).success) {
        alert('Восстановление парсинга Украины запущено! Проверяйте логи backend.');
        
        const interval = setInterval(() => {
          fetchStats();
          fetchCities();
          fetchParsingStats();
        }, 15000);
        
        setTimeout(() => {
          clearInterval(interval);
          setResuming(false);
        }, 600000);
      }
    } catch (error) {
      console.error('Error resuming parsing:', error);
      alert('Ошибка восстановления парсинга');
      setResuming(false);
    }
  };

  const testInstagramAccess = async () => {
  try {
    setLoading(true);
    const response = await axios.get('http://localhost:3001/api/locations/test/access');
    const data = response.data as any;
    
    if (data.accessible) {
      alert('✅ Instagram доступен! Можно продолжать парсинг.');
    } else {
      alert('❌ Instagram все еще заблокирован. Попробуйте сменить IP или подождать.');
    }
  } catch (error) {
    alert('Ошибка тестирования доступа');
    console.error('Test error:', error);
  } finally {
    setLoading(false);
  }
};

const testGuestAccess = async () => {
  try {
    setLoading(true);
    const response = await axios.get('http://localhost:3001/api/locations/test/guest');
    const data = response.data as any;
    
    if (data.guestAccessible) {
      alert('✅ Гостевой доступ работает! Instagram доступен без авторизации. Можно попробовать парсинг без логина.');
    } else {
      alert('❌ Гостевой доступ тоже заблокирован. IP полностью заблокирован.');
    }
  } catch (error) {
    alert('Ошибка тестирования гостевого доступа');
    console.error('Guest test error:', error);
  } finally {
    setLoading(false);
  }
};

  

  useEffect(() => {
    fetchStats();
    fetchCities();
    fetchParsingStats();
  }, []);

  return (
    <div style={{
      background: 'white',
      padding: '20px',
      borderRadius: '8px',
      marginTop: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{margin: '0 0 20px 0', color: '#333'}}>📊 База данных локаций</h3>
      
      {/* Статистика */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '15px',
        marginBottom: '20px'
      }}>
        <div style={{textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
          <div style={{fontSize: '24px', fontWeight: 'bold', color: '#007bff'}}>
            {stats?.countries || 0}
          </div>
          <div style={{fontSize: '12px', color: '#666'}}>Стран</div>
        </div>
        
        <div style={{textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
          <div style={{fontSize: '24px', fontWeight: 'bold', color: '#28a745'}}>
            {stats?.cities || 0}
          </div>
          <div style={{fontSize: '12px', color: '#666'}}>Городов</div>
        </div>
        
        <div style={{textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
          <div style={{fontSize: '24px', fontWeight: 'bold', color: '#dc3545'}}>
            {stats?.locations || 0}
          </div>
          <div style={{fontSize: '12px', color: '#666'}}>Локаций</div>
        </div>
        
        <div style={{textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
          <div style={{fontSize: '24px', fontWeight: 'bold', color: '#6c757d'}}>
            {stats?.files.length || 0}
          </div>
          <div style={{fontSize: '12px', color: '#666'}}>Файлов</div>
        </div>
      </div>

      {/* Кнопки создания базы */}
      <div style={{marginBottom: '20px'}}>
        <h4 style={{margin: '0 0 10px 0'}}>Создать базу данных:</h4>
        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
          <button
            onClick={() => createDatabase('ukraine')}
            disabled={creating !== null}
            style={{
              padding: '8px 16px',
              backgroundColor: creating === 'ukraine' ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: creating !== null ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {creating === 'ukraine' ? '🔄 Создается...' : '🇺🇦 Украина'}
          </button>
          
          <button
            onClick={() => createDatabase('poland')}
            disabled={creating !== null}
            style={{
              padding: '8px 16px',
              backgroundColor: creating === 'poland' ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: creating !== null ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {creating === 'poland' ? '🔄 Создается...' : '🇵🇱 Польша'}
          </button>
          
          <button
            onClick={() => createDatabase('all')}
            disabled={creating !== null}
            style={{
              padding: '8px 16px',
              backgroundColor: creating === 'all' ? '#6c757d' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: creating !== null ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {creating === 'all' ? '🔄 Создается...' : '🌍 Все страны'}
          </button>
          
          <button
            onClick={() => { fetchStats(); fetchCities(); fetchParsingStats(); }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Обновить
          </button>
          <button
            onClick={testInstagramAccess}
            disabled={loading}
            style={{
                padding: '8px 16px',
                backgroundColor: loading ? '#6c757d' : '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px'
            }}
            >
            {loading ? '🔄 Тестируем...' : '🔍 Тест доступа'}
            </button>
        </div>
            <button
    onClick={testGuestAccess}
    disabled={loading}
    style={{
        padding: '8px 16px',
        backgroundColor: loading ? '#6c757d' : '#28a745',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: '14px'
    }}
    >
    {loading ? '🔄 Тестируем...' : '👤 Тест без логина'}
    </button>
      </div>

      {/* Статистика парсинга Украины */}
      {parsingStats?.ukraine && (
        <div style={{marginBottom: '20px'}}>
          <h4 style={{margin: '0 0 10px 0'}}>📊 Прогресс парсинга Украины:</h4>
          <div style={{
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px'}}>
              <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '20px', fontWeight: 'bold', color: '#28a745'}}>
                  {parsingStats.ukraine.processedCities}
                </div>
                <div style={{fontSize: '12px', color: '#666'}}>Обработано городов</div>
              </div>
              
              <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '20px', fontWeight: 'bold', color: '#dc3545'}}>
                  {parsingStats.ukraine.remainingCities}
                </div>
                <div style={{fontSize: '12px', color: '#666'}}>Осталось городов</div>
              </div>
              
              <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '20px', fontWeight: 'bold', color: '#007bff'}}>
                  {parsingStats.ukraine.completionPercentage}%
                </div>
                <div style={{fontSize: '12px', color: '#666'}}>Завершено</div>
              </div>
            </div>
            
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e9ecef',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '10px'
            }}>
              <div style={{
                width: `${parsingStats.ukraine.completionPercentage}%`,
                height: '100%',
                backgroundColor: '#28a745',
                transition: 'width 0.3s ease'
              }}></div>
            </div>
            
            <div style={{textAlign: 'center'}}>
              <button
                onClick={resumeParsing}
                disabled={resuming || parsingStats.ukraine.remainingCities === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: resuming ? '#6c757d' : '#ffc107',
                  color: resuming ? 'white' : '#212529',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: resuming || parsingStats.ukraine.remainingCities === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {resuming ? '🔄 Восстанавливается...' : 
                 parsingStats.ukraine.remainingCities === 0 ? '✅ Парсинг завершен' : 
                 '▶️ Продолжить парсинг'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Доступные города */}
      {cities.length > 0 && (
        <div>
          <h4 style={{margin: '0 0 10px 0'}}>Доступные города ({cities.length}):</h4>
          <div style={{
            maxHeight: '150px',
            overflowY: 'auto',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            padding: '10px'
          }}>
            {cities.map((city, index) => (
              <div key={index} style={{
                padding: '5px 10px',
                borderBottom: '1px solid #f8f9fa',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{fontWeight: '500'}}>{city.name}</span>
                <span style={{fontSize: '12px', color: '#666'}}>{city.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {creating && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          ⏳ Создается база данных для {creating}. Процесс может занять несколько минут. 
          Следите за прогрессом в логах backend сервера.
        </div>
      )}
    </div>
  );
};

export default LocationDatabase;