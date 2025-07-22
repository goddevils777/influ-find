import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SearchForm.css';

const SearchForm: React.FC = () => {
console.log('🚀 НАЧАЛО: selectedLocations при загрузке компонента:', sessionStorage.getItem('selectedLocations'));
  const [countries, setCountries] = useState<any[]>([]);
  
  const [cities, setCities] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);


  
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  // ДОБАВЬ ЭТУ СТРОКУ ЗДЕСЬ:
const [isRestoringFromStorage, setIsRestoringFromStorage] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // ДОБАВЬ НОВЫЕ useState ЗДЕСЬ:
  const [searchingCountry, setSearchingCountry] = useState(false);
  const [searchingCity, setSearchingCity] = useState(false);
  const [countrySearchText, setCountrySearchText] = useState('');
  const [citySearchText, setCitySearchText] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Загружаем страны при монтировании
  // Загружаем страны при монтировании
useEffect(() => {
  fetchCountries();
}, []);

// Отдельный useEffect для восстановления состояния ПОСЛЕ загрузки стран
useEffect(() => {
  if (countries.length > 0) {
    const savedCountry = sessionStorage.getItem('selectedCountry');
    if (savedCountry) {
      console.log('🌍 Восстанавливаем страну:', savedCountry);
      setSelectedCountry(savedCountry);
      fetchCities(savedCountry);
    }
  }
}, [countries]);

// Восстанавливаем город ПОСЛЕ загрузки городов
useEffect(() => {
  if (cities.length > 0) {
    const savedCity = sessionStorage.getItem('selectedCity');
    if (savedCity) {
      setSelectedCity(savedCity);
      fetchLocations(savedCity);
    }
  }
}, [cities]);



// Восстанавливаем локации ПОСЛЕ загрузки локаций с задержкой
useEffect(() => {
  console.log('🔍 useEffect для восстановления локаций сработал');
  
  if (locations.length > 0) {
    console.log('✅ Локации загружены:', locations.length);
    setTimeout(() => {
      const savedLocations = sessionStorage.getItem('selectedLocations');
      console.log('💾 Сохраненные локации из sessionStorage:', savedLocations);
      
      if (savedLocations && savedLocations !== '[]') {
        try {
          const parsed = JSON.parse(savedLocations);
          console.log('📝 Восстанавливаем локации:', parsed);
          setSelectedLocations(parsed);
        } catch (error) {
          console.error('❌ Ошибка парсинга:', error);
        }
      }
      
      // Разрешаем сохранение после восстановления
      setIsRestoringFromStorage(false);
    }, 100);
  }
}, [locations]);

// Восстанавливаем результаты
useEffect(() => {
  const savedResults = sessionStorage.getItem('searchResults');
  if (savedResults) {
    setResults(JSON.parse(savedResults));
  }
}, []);



useEffect(() => {
  if (selectedCountry) {
    sessionStorage.setItem('selectedCountry', selectedCountry);
  }
}, [selectedCountry]);

useEffect(() => {
  if (selectedCity) {
    sessionStorage.setItem('selectedCity', selectedCity);
  }
}, [selectedCity]);


useEffect(() => {
  if (results) {
    sessionStorage.setItem('searchResults', JSON.stringify(results));
  }
}, [results]);

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
    
    } catch (error) {
      console.error('Error fetching cities:', error);
      setCities([]);
    }
  };

  const fetchLocations = async (cityId: string) => {
    try {
      const response = await axios.get(`http://localhost:3001/api/locations/locations/${cityId}`);
      setLocations((response.data as any).locations || []);

    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    }
  };

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);

    
  // ДОБАВЬ СОХРАНЕНИЕ:
  if (countryCode) {
    sessionStorage.setItem('selectedCountry', countryCode);
    fetchCities(countryCode);
  } else {
    sessionStorage.removeItem('selectedCountry');
    setCities([]);
    setLocations([]);
    setSelectedCity('');
  }
  };

  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
  // ДОБАВЬ СОХРАНЕНИЕ:
  if (cityId) {
    sessionStorage.setItem('selectedCity', cityId);
    fetchLocations(cityId);
  } else {
    sessionStorage.removeItem('selectedCity');
    setLocations([]);
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
  

      // ДОБАВЬ ЭТУ СТРОКУ:
      sessionStorage.setItem('searchResults', JSON.stringify(response.data));
      
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
      
      {/* Выбор страны С ПОИСКОМ */}
<div className="form-group">
  <label>Выберите страну:</label>
  <div style={{ position: 'relative' }}>
   <input
  type="text"
  placeholder="Введите название страны..."
  value={countrySearchText}
  onChange={(e) => {
    const searchText = e.target.value;
    setCountrySearchText(searchText);
    setShowCountryDropdown(true);
    
    if (selectedCountry) {
      setSelectedCountry('');
      setCities([]);
      setLocations([]);
      setSelectedCity('');
    }
  }}
  onFocus={() => {
    setShowCountryDropdown(true);
    // Если поле пустое, показываем все страны
    if (!countrySearchText) {
      setCountrySearchText('');
    }
  }}
  onBlur={() => {
    setTimeout(() => {
      setShowCountryDropdown(false);
      const foundCountry = countries.find(country => 
        country.name.toLowerCase() === countrySearchText.toLowerCase()
      );
      if (foundCountry && !selectedCountry) {
        handleCountryChange(foundCountry.code);
        setCountrySearchText(foundCountry.name);
      }
    }, 200);
  }}
  className="search-input"
  style={{ width: '100%' }}
/>

{/* Показываем список при фокусе ИЛИ при печатании */}
{showCountryDropdown && (
  <div style={{
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: '200px',
    overflowY: 'auto',
    border: '1px solid #ccc',
    backgroundColor: 'white',
    zIndex: 1000,
    borderRadius: '4px'
  }}>
    {countries
      .filter(country => 
        !countrySearchText || 
        country.name.toLowerCase().includes(countrySearchText.toLowerCase())
      )
      .slice(0, 10)
      .map((country, index) => (
        <div
          key={`country-search-${country.code}-${index}`}
          onClick={() => {
            handleCountryChange(country.code);
            setCountrySearchText(country.name);
            setShowCountryDropdown(false);
          }}
          className="dropdown-item"
        >
          {country.name} ({country.code})
        </div>
      ))}
  </div>
)}
  </div>
</div>

{/* Выбор города С ПОИСКОМ */}
{selectedCountry && (
  <div className="form-group">
    <label>Выберите город:</label>
    <div style={{ position: 'relative' }}>
    <input
  type="text"
  placeholder="Введите название города..."
  value={citySearchText}
  onChange={(e) => {
    const searchText = e.target.value;
    setCitySearchText(searchText);
    setShowCityDropdown(true);
    
    if (selectedCity) {
      setSelectedCity('');
      setLocations([]);
    }
  }}
  onFocus={() => {
    setShowCityDropdown(true);
    if (!citySearchText) {
      setCitySearchText('');
    }
  }}
  onBlur={() => {
    setTimeout(() => {
      setShowCityDropdown(false);
      const foundCity = cities.find(city => 
        city.name.toLowerCase() === citySearchText.toLowerCase()
      );
      if (foundCity && !selectedCity) {
        handleCityChange(foundCity.id);
        setCitySearchText(foundCity.name);
      }
    }, 200);
  }}
  className="search-input"
  style={{ width: '100%' }}
/>

{showCityDropdown && cities.length > 0 && (
  <div style={{
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: '200px',
    overflowY: 'auto',
    border: '1px solid #ccc',
    backgroundColor: 'white',
    zIndex: 1000,
    borderRadius: '4px'
  }}>
    {cities
      .filter(city => 
        !citySearchText || 
        city.name.toLowerCase().includes(citySearchText.toLowerCase())
      )
      .slice(0, 15)
      .map((city, index) => (
        <div
          key={`city-search-${city.id}-${index}`}
          onClick={() => {
            handleCityChange(city.id);
            setCitySearchText(city.name);
            setShowCityDropdown(false);
          }}
          className="dropdown-item"
        >
          {city.name}
        </div>
      ))}
  </div>
)}
    </div>
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
                 {locations.map((location, index) => {
                      const isChecked = selectedLocations.includes(location.id);
                   
                      
                      return (
                        <label key={`location-${location.id}-${index}`} style={{ display: 'block', margin: '5px 0' }}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
onChange={(e) => {
  if (e.target.checked) {
    setSelectedLocations(prev => {
      const newSelected = [...prev, location.id];
      sessionStorage.setItem('selectedLocations', JSON.stringify(newSelected));
      return newSelected;
    });
  } else {
    setSelectedLocations(prev => {
      const newSelected = prev.filter(id => id !== location.id);
      sessionStorage.setItem('selectedLocations', JSON.stringify(newSelected));
      return newSelected;
    });
  }
}}
                        />
                        <span style={{ marginLeft: '8px' }}>{location.name}</span>
                      </label>
                    );
                  })}
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
      <strong>Город:</strong> 
      <a 
        href={`https://www.instagram.com/explore/locations/?search=${results.data.city}`}
        target="_blank" 
        rel="noopener noreferrer"
        style={{ color: '#007bff', textDecoration: 'none', marginLeft: '5px' }}
      >
        {results.data.city} 🔗
      </a>
      <br/>
      
      <strong>Локаций обработано:</strong> {results.data.locationsSearched}
      <br/>
      
      {/* ОБНОВЛЕННЫЙ БЛОК СО ССЫЛКАМИ ЧЕРЕЗ ЗАПЯТУЮ */}
      {results.data.processedLocations && (
        <div style={{ marginTop: '5px' }}>
          <strong>Обработанные локации:</strong>{' '}
          {results.data.processedLocations.map((location: any, index: number) => (
            <span key={index}>
              <a 
                href={location.url}
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#007bff', textDecoration: 'none' }}
              >
                {location.name} 🔗
              </a>
              {index < results.data.processedLocations.length - 1 && ', '}
            </span>
          ))}
        </div>
      )}
      
      <br/>
      <strong>Найдено инфлюенсеров:</strong> {results.data.totalFound}
    </p>

    {results.data.influencers.length > 0 ? (
      <div className="influencers-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px', marginTop: '15px' }}>
        {results.data.influencers.map((influencer: any, index: number) => (
          <div key={index} className="influencer-card" style={{ 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            padding: '15px', 
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {/* ЗАГОЛОВОК С ИМЕНЕМ И ЛОКАЦИЕЙ */}
            <div style={{ marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#333' }}>
                <a 
                  href={`https://www.instagram.com/${influencer.username}/`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#333', textDecoration: 'none' }}
                >
                  @{influencer.username} 🔗
                </a>
              </h4>
              
              {/* НАЗВАНИЕ ЛОКАЦИИ ГДЕ НАЙДЕН */}
              {influencer.foundInLocation && (
                <p style={{ margin: '0', fontSize: '12px', color: '#28a745', fontWeight: 'bold' }}>
                  📍 Найден в: 
                  <a 
                    href={influencer.foundInLocation.url}
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#28a745', textDecoration: 'none', marginLeft: '3px' }}
                  >
                    {influencer.foundInLocation.name} 🔗
                  </a>
                </p>
              )}
            </div>
            
            {/* СТАТИСТИКА */}
            <div style={{ marginBottom: '10px' }}>
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                👥 <strong>{influencer.followersCount?.toLocaleString()}</strong> подписчиков
              </p>
              
              <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
                📊 <strong>Просмотры reels:</strong> {influencer.reelsViews ? influencer.reelsViews.join(', ') : 'Нет данных'}
              </p>
            </div>
            
            {/* ПОЛНОЕ ОПИСАНИЕ БЕЗ ОБРЕЗАНИЯ */}
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '5px',
              borderLeft: '3px solid #007bff'
            }}>
              <p style={{ 
                margin: '0', 
                fontSize: '13px', 
                color: '#444', 
                lineHeight: '1.4',
                fontStyle: 'italic'
              }}>
                📝 <strong>Описание:</strong><br/>
                {influencer.bio || 'Описание не указано'}
              </p>
            </div>
            
            {/* ПОЛНОЕ ИМЯ ЕСЛИ ЕСТЬ */}
            {influencer.fullName && influencer.fullName !== influencer.username && (
              <p style={{ 
                margin: '8px 0 0 0', 
                fontSize: '12px', 
                color: '#888',
                textAlign: 'center'
              }}>
                <strong>Полное имя:</strong> {influencer.fullName}
              </p>
            )}
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