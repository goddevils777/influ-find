import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ParserStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3001/api/search/status');
      setStats(response.data);
    } catch (error) {
      console.error('Stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  return (
    <div style={{
      background: 'white',
      padding: '15px',
      borderRadius: '8px',
      marginTop: '20px',
      fontSize: '14px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h4 style={{margin: '0 0 10px 0', color: '#333'}}>📊 Статистика системы</h4>
      
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px'}}>
        <div>
          <strong>Статус парсера:</strong><br/>
          <span style={{color: stats.isRunning ? '#dc3545' : '#28a745'}}>
            {stats.isRunning ? '🔄 Работает' : '✅ Готов'}
          </span>
        </div>
        
        <div>
          <strong>Кэш:</strong><br/>
          <span style={{color: '#007bff'}}>
            {stats.cache.size} городов
          </span>
        </div>
        
        <div>
          <strong>Обновление:</strong><br/>
          <button 
            onClick={fetchStats}
            disabled={loading}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {loading ? '...' : '🔄'}
          </button>
        </div>
      </div>
      
      {stats.cache.keys.length > 0 && (
        <div style={{marginTop: '10px', fontSize: '12px', color: '#666'}}>
          <strong>Города в кэше:</strong> {stats.cache.keys.join(', ')}
        </div>
      )}
    </div>
  );
};

export default ParserStats;