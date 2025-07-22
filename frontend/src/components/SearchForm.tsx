// frontend/src/components/SearchForm.tsx
import React from 'react';
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
    setSelectedLocations,
    isRestoringFromStorage,
    loading,
    results,
    error,
    countrySearchText,
    setCountrySearchText,
    citySearchText,
    setCitySearchText,
    showCountryDropdown,
    setShowCountryDropdown,
    showCityDropdown,
    setShowCityDropdown,
    locationSearchText,
    setLocationSearchText,
    handleCountryChange,
    handleCityChange,
    handleParseCity,
    handleSearchInfluencers,
    handleForceRefresh,
    handleParseProfile
  } = useSearchForm();

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
      <h2 className={styles.title}>Поиск инфлюенсеров по локациям</h2>
      
      {/* Выбор страны */}
      <div className={styles.formGroup}>
        <label className={styles.label}>Выберите страну:</label>
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
      </div>

      {/* Выбор города */}
      {selectedCountry && (
        <div className={styles.formGroup}>
          <label className={styles.label}>Выберите город:</label>
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
        </div>
      )}

      {/* Локации или парсинг */}
      {selectedCity && (
        <div className={styles.formGroup}>
          {locations.length === 0 ? (
            <div>
              <p>Локации для этого города не найдены в базе</p>
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
              <p>Найдено локаций: {locations.length}</p>
              
              <div>
                <h4>Выберите локации для парсинга постов:</h4>
                
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

                {/* Список локаций */}
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

                {/* Кнопки поиска */}
                {selectedLocations.length > 0 && (
                  <div className={styles.buttonGroup}>
                    <button 
                      onClick={handleSearchInfluencers}
                      disabled={loading}
                      className={`${styles.button} ${styles.buttonPrimary}`}
                    >
                      {loading ? 'Ищем инфлюенсеров...' : `Найти инфлюенсеров в ${selectedLocations.length} локациях`}
                    </button>
                    
                    <button 
                      onClick={handleForceRefresh}
                      disabled={loading}
                      className={`${styles.button} ${styles.buttonRefresh}`}
                    >
                      {loading ? 'Обновляем...' : '🔄 Принудительное обновление'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
                    {/* Аватарка */}
                    {influencer.avatarUrl && (
                      <img 
                        src={influencer.avatarUrl} 
                        alt={`@${influencer.username}`}
                        className={styles.avatar}
                        onError={(e) => {
                          // Скрываем аватарку если не загрузилась
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    
                    <div className={styles.cardInfo}>
                      <h4 className={styles.cardTitle}>
                        <a 
                          href={`https://www.instagram.com/${influencer.username}/`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={styles.cardTitleLink}
                        >
                          @{influencer.username} 🔗
                        </a>
                        <button
                          onClick={() => handleCopyUsername(influencer.username)}
                          className={styles.copyButtonSmall}
                          title="Копировать ник"
                        >
                          📋
                        </button>
                      </h4>
                      
                      {influencer.foundInLocation && (
                        <p className={styles.cardLocation}>
                          📍 Найден в: 
                          <a 
                            href={influencer.foundInLocation.url}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.cardLocationLink}
                          >
                            {influencer.foundInLocation.name} 🔗
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
                  
                  {/* Полное имя */}
                  {influencer.fullName && influencer.fullName !== influencer.username && (
                    <p className={styles.cardFullName}>
                      <strong>Полное имя:</strong> {influencer.fullName}
                    </p>
                  )}
                  
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