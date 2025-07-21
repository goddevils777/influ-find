import React, { useState } from 'react';
import axios from 'axios';
import './SearchForm.css';

const SearchForm: React.FC = () => {
  const [cityName, setCityName] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [minFollowers, setMinFollowers] = useState<number>(5000);

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCityName(e.target.value);
    if (results) {
      setResults(null); // Очищаем результаты при изменении города
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setResults(null);
    setLoading(true);
    
    try {
      setError('');
      const response = await axios.post('http://localhost:3001/api/search/city', {
        cityName: cityName.trim()
      });
      setResults(response.data);
    } catch (error) {
      setError('Ошибка поиска. Проверьте подключение к серверу.');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceParse = async () => {
  if (!cityName.trim()) {
    setError('Введите название города для парсинга');
    return;
  }
  
  setResults(null);
  setLoading(true);
  setError('');
  
  try {
    const response = await axios.post('http://localhost:3001/api/search/parse', {
      cityName: cityName.trim()
    });
    setResults(response.data);
  } catch (error) {
    setError('Ошибка парсинга. Попробуйте позже.');
    console.error('Parse error:', error);
  } finally {
    setLoading(false);
  }
};



  return (
    <div className="search-container">
      <form onSubmit={handleSearch} className="search-form">
        <input 
          type="text" 
          value={cityName}
          onChange={handleCityChange}
          placeholder="Введите название города"
          className="search-input"
        />
        <select 
        value={minFollowers}
        onChange={(e) => setMinFollowers(Number(e.target.value))}
        className="search-input"
        style={{width: '200px', marginLeft: '10px'}}
        >
        <option value={1000}>1K+ подписчиков</option>
        <option value={5000}>5K+ подписчиков</option>
        <option value={10000}>10K+ подписчиков</option>
        <option value={25000}>25K+ подписчиков</option>
        <option value={50000}>50K+ подписчиков</option>
        </select>
        <button 
          type="submit" 
          disabled={loading}
          className="search-button"
        >
          {loading ? 'Поиск...' : 'Найти инфлюенсеров'}
        </button>
        <button 
      type="button"
      onClick={handleForceParse}
      disabled={loading}
      className="search-button"
      style={{
        backgroundColor: '#dc3545',
        marginLeft: '10px'
      }}
    >
      Принудительный парсинг
    </button>
      </form>

      {error && (
        <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '1px solid #f5c6cb'
        }}>
            {error}
        </div>
        )}
      
      {results && (
        <div>
            <h3 className="results-title">
            Найдено: {results.data.influencers.length} инфлюенсеров в городе {results.data.city}
            {results.cached && (
                <span style={{
                fontSize: '14px',
                color: '#28a745',
                marginLeft: '10px',
                fontWeight: 'normal'
                }}>
                ⚡ Из кэша
                </span>
            )}
            {results.data.lastUpdated && (
                <div style={{
                fontSize: '12px',
                color: '#6c757d',
                fontWeight: 'normal',
                marginTop: '5px'
                }}>
                Обновлено: {new Date(results.data.lastUpdated).toLocaleString('ru-RU')}
                </div>
            )}
            </h3>
          
          <table className="results-table">
            <thead className="table-header">
              <tr>
                <th>Профиль</th>
                <th>Подписчики</th>
                <th>Описание</th>
                <th>Контакты</th>
              </tr>
            </thead>
            <tbody>
              {results.data.influencers
                .filter((influencer: any) => influencer.followersCount >= minFollowers)
                .map((influencer: any) => (
                <tr key={influencer.id} className="table-row">
                  <td className="profile-cell">
                    <div className="username">@{influencer.username}</div>
                    <div>{influencer.fullName}</div>
                  </td>
                  <td className="followers-count">
                    {influencer.followersCount.toLocaleString()}
                  </td>
                  <td className="bio-text">
                    {influencer.bio}
                  </td>
                  <td className="contact-info">
                    📧 {influencer.email}<br/>
                    💬 {influencer.telegram}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SearchForm;