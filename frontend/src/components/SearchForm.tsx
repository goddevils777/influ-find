import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SearchForm.css';

const SearchForm: React.FC = () => {
  const [countries, setCountries] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Загружаем страны при монтировании
  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/locations/countries');
      setCountries((response.data as any).countries || []);
    } catch (error) {
      console.error('Error fetching countries:', error);
    }
  };

  const fetchCities = async (countryCode: string) => {
    try {
      const response = await axios.get(`http://localhost:3001/api/locations/cities/${countryCode}`);
      setCities((response.data as any).cities || []);
      setSelectedCity('');
      setLocations([]);
      setSelectedLocations([]);
    } catch (error) {
      console.error('Error fetching cities:', error);
      setCities([]);
    }
  };

  const fetchLocations = async (cityId: string) => {
    try {
      const response = await axios.get(`http://localhost:3001/api/locations/locations/${cityId}`);
      setLocations((response.data as any).locations || []);
      setSelectedLocations([]);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    }
  };

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    if (countryCode) {
      fetchCities(countryCode);
    } else {
      setCities([]);
      setLocations([]);
      setSelectedCity('');
      setSelectedLocations([]);
    }
  };

  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    if (cityId) {
      fetchLocations(cityId);
    } else {
      setLocations([]);
      setSelectedLocations([]);
    }
  };

  const handleParseCity = async () => {
    if (!selectedCity) return;
    
    setLoading(true);
    setError('');
    
    try {
      const selectedCityData = cities.find(city => city.id === selectedCity);
      const response = await axios.post('http://localhost:3001/api/search/city', {
        cityName: selectedCityData?.name,
        guestMode: true
      });
      
      // После парсинга перезагружаем локации
      await fetchLocations(selectedCity);
      
    } catch (error) {
      setError('Ошибка парсинга города. Попробуйте позже.');
      console.error('Parse error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchInfluencers = async () => {
    console.log('🔍 Кнопка поиска нажата, selectedLocations:', selectedLocations);
    if (selectedLocations.length === 0) return;
    
    setLoading(true);
    setError('');
    setResults(null);
    
    try {
      const selectedCityData = cities.find(city => city.id === selectedCity);
      const selectedLocationData = locations.filter(loc => selectedLocations.includes(loc.id));
      
      const response = await axios.post('http://localhost:3001/api/search/locations', {
        cityName: selectedCityData?.name,
        cityId: selectedCity,
        locations: selectedLocationData,
        guestMode: true
      });
      
      setResults(response.data);
      
    } catch (error) {
      setError('Ошибка поиска инфлюенсеров. Попробуйте позже.');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForceRefresh = async () => {
    if (selectedLocations.length === 0) return;
    
    setLoading(true);
    setError('');
    setResults(null);
    
    try {
      const selectedCityData = cities.find(city => city.id === selectedCity);
      const selectedLocationData = locations.filter(loc => selectedLocations.includes(loc.id));
      
      console.log(`🔄 Принудительное обновление для ${selectedLocations.length} локаций`);
      
      const response = await axios.post('http://localhost:3001/api/search/locations', {
        cityName: selectedCityData?.name,
        cityId: selectedCity,
        locations: selectedLocationData,
        guestMode: true,
        forceRefresh: true
      });
      
      setResults(response.data);
      
    } catch (error) {
      setError('Ошибка принудительного обновления. Попробуйте позже.');
      console.error('Force refresh error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-container">
      <h2>Поиск инфлюенсеров по локациям</h2>
      
      {/* Выбор страны */}
      <div className="form-group">
        <label>Выберите страну:</label>
        <select 
          value={selectedCountry} 
          onChange={(e) => handleCountryChange(e.target.value)}
          className="search-input"
        >
          <option value="">-- Выберите страну --</option>
          {countries.map(country => (
            <option key={country.code} value={country.code}>
              {country.name} ({country.code})
            </option>
          ))}
        </select>
      </div>

      {/* Выбор города */}
      {selectedCountry && (
        <div className="form-group">
          <label>Выберите город:</label>
          <select 
            value={selectedCity} 
            onChange={(e) => handleCityChange(e.target.value)}
            className="search-input"
          >
            <option value="">-- Выберите город --</option>
            {cities.map(city => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Показать локации или запустить парсинг */}
      {selectedCity && (
        <div className="form-group">
          {locations.length === 0 ? (
            <div>
              <p>Локации для этого города не найдены в базе</p>
              <button 
                onClick={handleParseCity}
                disabled={loading}
                className="search-button"
              >
                {loading ? 'Парсинг...' : 'Спарсить локации города'}
              </button>
            </div>
          ) : (
            <div>
              <p>Найдено локаций: {locations.length}</p>
              
              {/* Список локаций для выбора */}
              <div className="locations-list">
                <h4>Выберите локации для парсинга постов:</h4>
                <div style={{ maxHeight: '200px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px' }}>
                  {locations.map((location, index) => (
                    <label key={`${location.id}-${index}`} style={{ display: 'block', margin: '5px 0' }}>
                      <input 
                        type="checkbox"
                        checked={selectedLocations.includes(location.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLocations([...selectedLocations, location.id]);
                          } else {
                            setSelectedLocations(selectedLocations.filter(id => id !== location.id));
                          }
                        }}
                      />
                      <span style={{ marginLeft: '8px' }}>{location.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Кнопки поиска постов */}
              {selectedLocations.length > 0 && (
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={handleSearchInfluencers}
                    disabled={loading}
                    className="search-button"
                  >
                    {loading ? 'Ищем инфлюенсеров...' : `Найти инфлюенсеров в ${selectedLocations.length} локациях`}
                  </button>
                  
                  <button 
                    onClick={handleForceRefresh}
                    disabled={loading}
                    className="search-button"
                    style={{ 
                      backgroundColor: loading ? '#ccc' : '#ff6b35',
                      borderColor: '#ff6b35'
                    }}
                  >
                    {loading ? 'Обновляем...' : '🔄 Принудительное обновление'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Отображение результатов */}
      {results && (
        <div className="results-container" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
          <h3>Результаты поиска</h3>
          <p>
            <strong>Город:</strong> {results.data.city} <br/>
            <strong>Локаций обработано:</strong> {results.data.locationsSearched} <br/>
            <strong>Найдено инфлюенсеров:</strong> {results.data.totalFound}
          </p>

          {results.data.influencers.length > 0 ? (
            <div className="influencers-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px', marginTop: '15px' }}>
              {results.data.influencers.map((influencer: any, index: number) => (
                <div key={index} className="influencer-card" style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  backgroundColor: 'white' 
                }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>@{influencer.username}</h4>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    👥 {influencer.followersCount?.toLocaleString()} подписчиков
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    📊 Просмотры reels: {influencer.reelsViews ? influencer.reelsViews.join(', ') : 'Нет данных'}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>
                    📝 {influencer.bio?.substring(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p>Инфлюенсеры не найдены в выбранных локациях</p>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: '10px', color: 'red', fontSize: '14px' }}>
          {error}
        </div>
      )}

    </div>
  );
};

export default SearchForm;