// frontend/src/components/SearchForm.tsx
import React from 'react';
import axios from 'axios';
import { useSearchForm } from '../hooks/useSearchForm';
import { copyToClipboard, copyAllUsernames, showCopyNotification } from '../utils/copyUtils';
import styles from './SearchForm.module.css';

const SearchForm: React.FC = () => {
  const {
    countries,
    cities,
    locations,
    selectedCountry,
    selectedCity,
    selectedLocations,
    loading,
    results,
    error,
    countrySearchText,
    citySearchText,
    showCountryDropdown,
    showCityDropdown,
    locationSearchText,
    isRestoringFromStorage,
    setSelectedCountry,
    setSelectedCity,
    setSelectedLocations,
    setCountrySearchText,
    setCitySearchText,
    setShowCountryDropdown,
    setShowCityDropdown,
    setLocationSearchText,
    handleSearch,
    handleParseProfile,
    parseCitiesInCountry,
    fetchCities,
    fetchLocations
  } = useSearchForm();

  // Обработчик выбора страны
  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setSelectedLocations([]);
    
    if (countryCode) {
      sessionStorage.setItem('selectedCountry', countryCode);
    } else {
      sessionStorage.removeItem('selectedCountry');
    }
    
    sessionStorage.removeItem('selectedLocations');
    
    if (countryCode) {
      fetchCities(countryCode);
    }
  };

  // Обработчик выбора города
  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    setSelectedLocations([]);
    
    if (cityId) {
      sessionStorage.setItem('selectedCity', cityId);
    } else {
      sessionStorage.removeItem('selectedCity');
    }
    
    sessionStorage.removeItem('selectedLocations');
    
    if (cityId) {
      fetchLocations(cityId);
    }
  };

  // Парсинг локаций города
  const handleParseCity = async () => {
    if (!selectedCity) return;
    
    const selectedCityData = cities.find(city => city.id === selectedCity);
    
    if (!selectedCityData) {
      console.error('Город не найден');
      return;
    }
    
    console.log(`🏙️ Парсим локации для города: ${selectedCityData.name}`);
    
    try {
      await axios.post<{success: boolean}>('http://localhost:3001/api/search/city', {
        cityName: selectedCityData.name,
        guestMode: true
      });
      
      await fetchLocations(selectedCity);
      
    } catch (error) {
      console.error('Parse city locations error:', error);
    }
  };

  // Поиск инфлюенсеров - ТОЛЬКО из базы/кэша
  const handleSearchInfluencers = () => {
    handleSearch(false);
  };

  // Принудительное обновление - с парсингом
  const handleForceRefresh = () => {
    handleSearch(true);
  };

  // Функция копирования ника
  const handleCopyUsername = async (username: string) => {
    const success = await copyToClipboard(`@${username}`);
    if (success) {
      showCopyNotification(`Ник @${username} скопирован!`);
    }
  };

  // Функция копирования всех ников
  const handleCopyAllUsernames = async () => {
    if (!results?.data?.influencers?.length) return;
    
    const allUsernames = copyAllUsernames(results.data.influencers);
    const success = await copyToClipboard(allUsernames);
    
    if (success) {
      showCopyNotification(`${results.data.influencers.length} ников скопировано!`);
    }
  };

  // Фильтрованные локации
  const filteredLocations = locations.filter(loc => 
    !locationSearchText || 
    loc.name.toLowerCase().includes(locationSearchText.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {/* Заголовок */}
      <div className={styles.header}>
        <h1 className={styles.title}>InfluFind</h1>
        <p className={styles.subtitle}>
          Найдите локальных инфлюенсеров Instagram по городам и локациям
        </p>
      </div>

      {/* Основная область с двумя колонками */}
      <div className={styles.mainContent}>
        
        {/* Левая колонка - Настройки поиска */}
        <div className={styles.leftColumn}>
          
          {/* Шаг 1: Выбор страны */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span className={styles.stepIndicator}>1</span>
              Выберите страну
            </div>
            <p className={styles.sectionDescription}>
              Начните с выбора страны для поиска инфлюенсеров
            </p>
            
            <div className={styles.formGroup}>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  placeholder="Введите название страны..."
                  value={countrySearchText}
                  onChange={(e) => {
                    const searchText = e.target.value;
                    setCountrySearchText(searchText);
                    setShowCountryDropdown(true);
                    
                    if (selectedCountry) {
                      handleCountryChange('');
                    }
                  }}
                  onFocus={() => setShowCountryDropdown(true)}
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
                  className={styles.searchInput}
                />

                {showCountryDropdown && (
                  <div className={styles.dropdown}>
                    {countries
                      .filter(country => 
                        !countrySearchText || 
                        country.name.toLowerCase().includes(countrySearchText.toLowerCase())
                      )
                      .slice(0, 10)
                      .map((country, index) => (
                        <div
                          key={`country-${country.code}-${index}`}
                          onClick={() => {
                            handleCountryChange(country.code);
                            setCountrySearchText(country.name);
                            setShowCountryDropdown(false);
                          }}
                          className={styles.dropdownItem}
                        >
                          {country.name} ({country.code})
                        </div>
                      ))}
                  </div>
                )}
              </div>
              {selectedCountry && (
                <p className={styles.helpText}>
                  ✅ Выбрана страна: {countrySearchText}
                </p>
              )}
            </div>
          </div>

          {/* Шаг 2: Выбор города */}
          {selectedCountry && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <span className={styles.stepIndicator}>2</span>
                Выберите город
              </div>
              <p className={styles.sectionDescription}>
                Выберите конкретный город для поиска локаций
              </p>
              
              <div className={styles.formGroup}>
                <div className={styles.inputWrapper}>
                  <input
                    type="text"
                    placeholder="Введите название города..."
                    value={citySearchText}
                    onChange={(e) => {
                      const searchText = e.target.value;
                      setCitySearchText(searchText);
                      setShowCityDropdown(true);
                      
                      if (selectedCity) {
                        handleCityChange('');
                      }
                    }}
                    onFocus={() => setShowCityDropdown(true)}
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
                    className={styles.searchInput}
                  />

                  {showCityDropdown && cities.length > 0 && (
                    <div className={styles.dropdown}>
                      {cities
                        .filter(city => 
                          !citySearchText || 
                          city.name.toLowerCase().includes(citySearchText.toLowerCase())
                        )
                        .slice(0, 15)
                        .map((city, index) => (
                          <div
                            key={`city-${city.id}-${index}`}
                            onClick={() => {
                              handleCityChange(city.id);
                              setCitySearchText(city.name);
                              setShowCityDropdown(false);
                            }}
                            className={styles.dropdownItem}
                          >
                            {city.name}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                {selectedCity && (
                  <p className={styles.helpText}>
                    ✅ Выбран город: {citySearchText}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Шаг 3: Локации */}
          {selectedCity && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <span className={styles.stepIndicator}>3</span>
                Выберите локации
              </div>
              
              {locations.length === 0 ? (
                <div>
                  <p className={styles.sectionDescription}>
                    Локации для этого города не найдены в базе данных
                  </p>
                  {cities.find(city => city.id === selectedCity) && (
                    <p className={styles.helpText}>
                      Проверьте сами: 
                      <a 
                        href={cities.find(city => city.id === selectedCity)?.url}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={styles.resultsLink}
                        style={{ marginLeft: '5px' }}
                      >
                        {cities.find(city => city.id === selectedCity)?.name} на Instagram 🔗
                      </a>
                    </p>
                  )}
                  <button 
                    onClick={handleParseCity}
                    disabled={loading}
                    className={`${styles.button} ${styles.buttonPrimary}`}
                  >
                    {loading ? 'Парсинг...' : 'Спарсить локации города'}
                  </button>
                </div>
              ) : (
                <div>
                  <p className={styles.sectionDescription}>
                    Найдено {locations.length} локаций. Выберите интересующие вас места для поиска инфлюенсеров.
                  </p>
                  
                  {/* Поиск локаций */}
                  <div className={styles.locationSearchContainer}>
                    <input
                      type="text"
                      placeholder="Поиск локаций (например: cafe, restaurant, bar...)"
                      value={locationSearchText}
                      onChange={(e) => setLocationSearchText(e.target.value)}
                      className={styles.locationSearchInput}
                    />
                    {locationSearchText && (
                      <p className={styles.locationCounter}>
                        Найдено локаций: {filteredLocations.length} из {locations.length}
                      </p>
                    )}
                  </div>

                  {/* Выбранные локации как теги */}
                  {selectedLocations.length > 0 && (
                    <div className={styles.selectedLocationsTags}>
                      <div className={styles.tagsHeader}>
                        <span className={styles.tagsTitle}>
                          Выбрано локаций ({selectedLocations.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLocations([]);
                            sessionStorage.setItem('selectedLocations', JSON.stringify([]));
                          }}
                          className={styles.clearAllButton}
                          title="Очистить все"
                        >
                          ✕ Очистить все
                        </button>
                      </div>
                      
                      <div className={styles.tagsContainer}>
                        {selectedLocations.map((locationId) => {
                          const location = locations.find(loc => loc.id === locationId);
                          if (!location) return null;
                          
                          return (
                            <div key={locationId} className={styles.locationTag}>
                              <span className={styles.tagText} title={location.name}>
                                {location.name.length > 25 ? 
                                  location.name.substring(0, 25) + '...' : 
                                  location.name
                                }
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newSelection = selectedLocations.filter(id => id !== locationId);
                                  setSelectedLocations(newSelection);
                                  sessionStorage.setItem('selectedLocations', JSON.stringify(newSelection));
                                }}
                                className={styles.tagRemoveButton}
                                title="Удалить"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className={styles.tagsActions}>
                        <span className={styles.tagsStats}>
                          {selectedLocations.length} из {locations.length} локаций
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Кнопки поиска */}
                  {selectedLocations.length > 0 && (
                    <div className={styles.section}>
                      <div className={styles.sectionTitle}>
                        <span className={styles.stepIndicator}>4</span>
                        Начать поиск
                      </div>
                      <p className={styles.sectionDescription}>
                        Выберите способ поиска инфлюенсеров
                      </p>
                      
                      <div className={styles.buttonGroup}>
                        <button 
                          onClick={handleSearchInfluencers}
                          disabled={loading}
                          className={`${styles.button} ${styles.buttonPrimary}`}
                          title="Найти инфлюенсеров из сохраненных данных (быстро)"
                        >
                          {loading ? 'Ищем...' : `📋 Показать из базы (${selectedLocations.length} локаций)`}
                        </button>
                        
                        <button 
                          onClick={handleForceRefresh}
                          disabled={loading}
                          className={`${styles.button} ${styles.buttonRefresh}`}
                          title="Спарсить новых инфлюенсеров с Instagram (медленно)"
                        >
                          {loading ? 'Парсим...' : '🔄 Спарсить новых инфлюенсеров'}
                        </button>
                      </div>
                      
                      <div className={styles.helpText}>
                        <strong>📋 Показать из базы:</strong> Быстро покажет сохраненных инфлюенсеров<br/>
                        <strong>🔄 Спарсить новых:</strong> Найдет новых инфлюенсеров с Instagram (займет больше времени)
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Правая колонка - Список локаций */}
        {selectedCity && locations.length > 0 && (
          <div className={styles.rightColumn}>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Доступные локации
              </div>
              <p className={styles.sectionDescription}>
                Отметьте галочкой интересующие локации
              </p>
              
              <div className={styles.locationsContainer}>
                {filteredLocations.map((location, index) => {
                  const isSelected = selectedLocations.includes(location.id);
                  
                  return (
                    <div 
                      key={`location-${location.id}-${index}`} 
                      className={`${styles.locationItem} ${isSelected ? styles.selected : ''}`}
                    >
                      <label className={styles.locationLabel}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (!isRestoringFromStorage) {
                              setSelectedLocations(prev => {
                                const newSelection = e.target.checked
                                  ? [...prev, location.id]
                                  : prev.filter(id => id !== location.id);
                                
                                sessionStorage.setItem('selectedLocations', JSON.stringify(newSelection));
                                return newSelection;
                              });
                            }
                          }}
                          className={styles.locationCheckbox}
                        />
                        <span className={`${styles.locationName} ${isSelected ? styles.selected : ''}`}>
                          {location.name}
                        </span>
                      </label>
                    </div>
                  );
                })}
                
                {/* Нет результатов */}
                {locationSearchText && filteredLocations.length === 0 && (
                  <p className={styles.noResults}>
                    Локации с названием "{locationSearchText}" не найдены
                  </p>
                )}
              </div>

              {/* Кнопки управления */}
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = [...selectedLocations, ...filteredLocations.map(loc => loc.id)];
                    const uniqueIds = allIds.filter((id, index) => allIds.indexOf(id) === index);
                    setSelectedLocations(uniqueIds);
                    sessionStorage.setItem('selectedLocations', JSON.stringify(uniqueIds));
                  }}
                  className={`${styles.button} ${styles.buttonSuccess}`}
                >
                  {locationSearchText ? 'Выбрать найденные' : 'Выбрать все'}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    const newSelection = selectedLocations.filter(id => 
                      !filteredLocations.some(loc => loc.id === id)
                    );
                    setSelectedLocations(newSelection);
                    sessionStorage.setItem('selectedLocations', JSON.stringify(newSelection));
                  }}
                  className={`${styles.button} ${styles.buttonDanger}`}
                >
                  {locationSearchText ? 'Отменить найденные' : 'Отменить все'}
                </button>
                
                {locationSearchText && (
                  <button
                    type="button"
                    onClick={() => setLocationSearchText('')}
                    className={`${styles.button} ${styles.buttonSecondary}`}
                  >
                    Очистить поиск
                  </button>
                )}
              </div>
              
              {selectedLocations.length > 0 && (
                <p className={styles.selectedCount}>
                  Выбрано локаций: {selectedLocations.length}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Результаты */}
      {results && (
        <div className={styles.resultsContainer}>
          <h3 className={styles.resultsTitle}>Результаты поиска</h3>
          <div className={styles.resultsInfo}>
            <p>
              <strong>Город:</strong> 
              <a 
                href={`https://www.instagram.com/explore/locations/?search=${results.data.city}`}
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.resultsLink}
              >
                {results.data.city} 🔗
              </a>
            </p>
            
            <p><strong>Локаций обработано:</strong> {results.data.locationsSearched}</p>
            
            {results.data.processedLocations && results.data.processedLocations.length > 0 && (
              <div>
                <strong>Обработанные локации:</strong>{' '}
                {results.data.processedLocations.map((location: any, index: number) => (
                  <span key={index}>
                    <a 
                      href={location.url}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={styles.resultsLink}
                    >
                      {location.name} 🔗
                    </a>
                    {index < results.data.processedLocations!.length - 1 && ', '}
                  </span>
                ))}
              </div>
            )}
            
            <p><strong>Найдено инфлюенсеров:</strong> {results.data.totalFound}</p>
            
            {/* Кнопка копирования всех ников */}
            {results.data.influencers.length > 0 && (
              <button
                onClick={handleCopyAllUsernames}
                className={styles.copyButton}
              >
                📋 Копировать все ники ({results.data.influencers.length})
              </button>
            )}
          </div>

          {results.data.influencers.length > 0 ? (
            <div className={styles.influencersGrid}>
              {results.data.influencers.map((influencer: any, index: number) => (
                <div key={index} className={styles.influencerCard}>
                  {/* Заголовок карточки с аватаркой */}
                  <div className={styles.cardHeaderWithAvatar}>
                    {/* Аватарка через прокси */}
                    {influencer.avatarUrl && (
                      <div className={styles.avatarContainer}>
                        <img 
                          src={`http://localhost:3001/api/locations/proxy/avatar?url=${encodeURIComponent(influencer.avatarUrl)}`}
                          alt={`@${influencer.username}`}
                          className={styles.avatar}
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            console.log(`❌ Не удалось загрузить аватарку для @${influencer.username}`);
                            // Заменяем на placeholder если не загрузилась
                            img.src = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiNmMGY5ZmYiLz4KPGJ5cGF0aCBkPSJNMzIgMTZjLTUuODggMC0xMC42NyA0Ljc5LTEwLjY3IDEwLjY3IDAgNS44OCA0Ljc5IDEwLjY2IDEwLjY3IDEwLjY2IDUuODggMCAxMC42Ni00Ljc4IDEwLjY2LTEwLjY2IDAtNS44OC00Ljc4LTEwLjY3LTEwLjY2LTEwLjY3em0wIDhjMi4yMSAwIDQgMS43OSA0IDRzLTEuNzkgNC00IDQtNC0xLjc5LTQtNCAxLjc5LTQgNC00em0wIDE2Yy00LjQxIDAtOC4yNy0yLjI1LTEwLjU2LTUuNjcgMi40MS0xLjcxIDUuMzMtMi43NiA4LjUzLTMgLjg1LjE3IDEuNzUuMjcgMi42Ny4yNy45MiAwIDEuODEtLjEgMi42Ny0uMjcgMy4yLjI0IDYuMTIgMS4yOSA4LjUzIDNDNDAuMjcgNDAuNzUgMzYuNDEgNDMgMzIgNDN6IiBmaWxsPSIjY2ZkOGRjIi8+Cjwvc3ZnPgo=`;
                            img.classList.add(styles.avatarPlaceholder);
                          }}
                          onLoad={() => {
                            console.log(`✅ Аватарка через прокси загружена для @${influencer.username}`);
                          }}
                        />
                      </div>
                    )}
                    
                    <div className={styles.cardInfo}>
                      <div className={styles.cardTitleRow}>
                        <h4 className={styles.cardTitle}>
                          <a 
                            href={`https://www.instagram.com/${influencer.username}/`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.cardTitleLink}
                          >
                            @{influencer.username}
                          </a>
                        </h4>
                        <div className={styles.cardActions}>
                          <a 
                            href={`https://www.instagram.com/${influencer.username}/`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.linkButton}
                            title="Открыть профиль"
                          >
                            🔗
                          </a>
                          <button
                            onClick={() => handleCopyUsername(influencer.username)}
                            className={styles.copyButtonSmall}
                            title="Копировать ник"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                      
                      {influencer.fullName && influencer.fullName !== influencer.username && (
                        <p className={styles.cardFullName}>
                          {influencer.fullName}
                        </p>
                      )}
                      
                      {influencer.foundInLocation && (
                        <p className={styles.cardLocation}>
                          📍 Найден в: 
                          <a 
                            href={influencer.foundInLocation.url}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.cardLocationLink}
                          >
                            {influencer.foundInLocation.name}
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Статистика */}
                  <div className={styles.cardStats}>
                    <p className={styles.cardStat}>
                      👥 <strong>{influencer.followersCount?.toLocaleString()}</strong> подписчиков
                    </p>
                    
                    {influencer.postsCount && (
                      <p className={styles.cardStat}>
                        📸 <strong>{influencer.postsCount}</strong> постов
                      </p>
                    )}
                    
                    <p className={styles.cardStat}>
                      📊 <strong>Просмотры reels:</strong> {influencer.reelsViews ? influencer.reelsViews.join(', ') : 'Нет данных'}
                    </p>
                    
                    {influencer.lastUpdated && (
                      <p className={styles.cardStat} style={{ fontSize: '11px', color: '#888' }}>
                        🕒 Обновлено: {new Date(influencer.lastUpdated).toLocaleString()}
                      </p>
                    )}
                  </div>
                  
                  {/* Описание */}
                  <div className={styles.cardBio}>
                    <p className={styles.cardBioText}>
                      📝 <strong>Описание:</strong><br/>
                      {influencer.bio || 'Описание не указано'}
                    </p>
                  </div>
                  
                  {/* Действия */}
                  <div className={styles.cardActions}>
                    <button
                      onClick={() => handleParseProfile(influencer.username)}
                      disabled={loading}
                      className={styles.parseButton}
                      title="Обновить данные профиля"
                    >
                      {loading ? '⏳' : '🔄 Обновить профиль'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>Инфлюенсеры не найдены в выбранных локациях</p>
          )}
        </div>
      )}

      {/* Ошибки */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
    </div>
  );
};

export default SearchForm;