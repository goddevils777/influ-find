// frontend/src/hooks/useSearchForm.ts
import { useState, useEffect } from 'react';
import axios from 'axios';
import { SearchResponse, ProfileResponse, Country, City, Location } from '../types/api';
import { Influencer } from '../types/influencer';
import { useAuth } from '../contexts/AuthContext';

export const useSearchForm = () => {
  // States
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  
  const [isRestoringFromStorage, setIsRestoringFromStorage] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string>('');
  
  const [countrySearchText, setCountrySearchText] = useState('');
  const [citySearchText, setCitySearchText] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [locationSearchText, setLocationSearchText] = useState('');
  const [maxPosts, setMaxPosts] = useState<number | string>(10);
  const handleContinueParsing = () => handleSearch(false, true);

  // Состояния для фильтров
  const [minFollowers, setMinFollowers] = useState<number | string>('');
  const [maxFollowers, setMaxFollowers] = useState<number | string>('');
  const [locationFilter, setLocationFilter] = useState('');
  const [minReelsViews, setMinReelsViews] = useState<number | string>('');

  const { user } = useAuth();


  // API функции
  const fetchCountries = async () => {
    try {
      const response = await axios.get<{countries: Country[]}>('http://localhost:3001/api/locations/countries');
      setCountries(response.data.countries || []);
    } catch (error) {
      console.error('Error fetching countries:', error);
    }
  };

  const fetchCities = async (countryCode: string) => {
    try {
      const response = await axios.get<{cities: City[]}>(`http://localhost:3001/api/locations/cities/${countryCode}`);
      setCities(response.data.cities || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
      setCities([]);
    }
  };

  const fetchLocations = async (cityId: string) => {
    try {
      const response = await axios.get<{locations: Location[]}>(`http://localhost:3001/api/locations/locations/${cityId}`);
      setLocations(response.data.locations || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    }
  };

  // Парсинг локаций города
  const handleParseCity = async () => {
    if (!selectedCity) return;
    
    setLoading(true);
    setError('');
    
    try {
      const selectedCityData = cities.find(city => city.id === selectedCity);
      await axios.post<{success: boolean}>('http://localhost:3001/api/search/city', {
        cityName: selectedCityData?.name,
        guestMode: true
      });
      
      await fetchLocations(selectedCity);
    } catch (error) {
      setError('Ошибка парсинга города. Попробуйте позже.');
      console.error('Parse error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Поиск инфлюенсеров
  const handleSearch = async (forceRefresh: boolean = false, continueParsing: boolean = false) => {
    if (selectedLocations.length === 0) return;
    
    setLoading(true);
    setError('');
    setResults(null);
    
    try {
      const selectedCityData = cities.find(city => city.id === selectedCity);
      const selectedLocationData = locations.filter(loc => selectedLocations.includes(loc.id));
      
    const response = await axios.post<SearchResponse>('http://localhost:3001/api/search/locations', {
    cityName: selectedCityData?.name,
    cityId: selectedCity,
    locations: selectedLocationData,
    guestMode: true,
    forceRefresh: forceRefresh,
    continueParsing: continueParsing,
    maxPosts: typeof maxPosts === 'number' ? maxPosts : 10
    });
      
      setResults(response.data);
      sessionStorage.setItem('searchResults', JSON.stringify(response.data));
    } catch (error) {
      setError('Ошибка поиска инфлюенсеров. Попробуйте позже.');
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Парсинг отдельного профиля
  const handleParseProfile = async (username: string) => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`🔍 Парсинг профиля @${username}`);
      
      const response = await axios.post<ProfileResponse>('http://localhost:3001/api/search/profile', {
        username: username
      });
      
      if (response.data.success && results) {
        console.log('📊 Получены обновленные данные:', response.data.data);
        
        // Обновляем данные инфлюенсера в результатах
        const updatedInfluencers = results.data.influencers.map((inf) => 
          inf.username === username ? {
            ...inf,
            followersCount: response.data.data.followersCount || inf.followersCount,
            fullName: response.data.data.fullName || inf.fullName,
            bio: response.data.data.bio || inf.bio,
            avatarUrl: response.data.data.avatarUrl || inf.avatarUrl,
            lastUpdated: response.data.data.lastUpdated
          } : inf
        );
        
        const updatedResults = {
          ...results,
          data: {
            ...results.data,
            influencers: updatedInfluencers
          }
        };
        
        setResults(updatedResults);
        console.log(`✅ Профиль @${username} обновлен в интерфейсе`);
        console.log(`   Аватарка: ${response.data.data.avatarUrl || 'НЕТ'}`);
        
      } else {
        setError('Не удалось обновить профиль');
      }
      
    } catch (error) {
      console.error('Parse profile error:', error);
      setError('Ошибка при обновлении профиля');
    } finally {
      setLoading(false);
    }
  };

  // Обработчики изменений
  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setSelectedCity('');
    setCitySearchText('');
    setLocations([]);
    setSelectedLocations([]);
    sessionStorage.setItem('selectedCountry', countryCode);
    sessionStorage.removeItem('selectedCity');
    sessionStorage.removeItem('selectedLocations');
    if (countryCode) {
      fetchCities(countryCode);
    }
  };
  
  const handleCityChange = (cityId: string) => {
    setSelectedCity(cityId);
    setSelectedLocations([]);
    sessionStorage.setItem('selectedCity', cityId);
    sessionStorage.removeItem('selectedLocations');
    if (cityId) {
      fetchLocations(cityId);
    }
  };

  // Effects
  useEffect(() => {
    fetchCountries();
  }, []);

  useEffect(() => {
    if (countries.length > 0) {
      const savedCountry = sessionStorage.getItem('selectedCountry');
      if (savedCountry) {
        setSelectedCountry(savedCountry);
        const countryData = countries.find(country => country.code === savedCountry);
        if (countryData) {
          setCountrySearchText(countryData.name);
        }
        fetchCities(savedCountry);
      }
    }
  }, [countries]);

  useEffect(() => {
    if (cities.length > 0 && selectedCountry) {
      const savedCity = sessionStorage.getItem('selectedCity');
      if (savedCity) {
        const cityData = cities.find(city => city.id === savedCity);
        if (cityData) {
          setSelectedCity(savedCity);
          setCitySearchText(cityData.name);
          fetchLocations(savedCity);
        } else {
          sessionStorage.removeItem('selectedCity');
          setSelectedCity('');
          setCitySearchText('');
        }
      }
    }
  }, [cities, selectedCountry]);

  useEffect(() => {
    if (locations.length > 0) {
      setTimeout(() => {
        const savedLocations = sessionStorage.getItem('selectedLocations');
        if (savedLocations && savedLocations !== '[]') {
          try {
            const parsed = JSON.parse(savedLocations);
            setSelectedLocations(parsed);
          } catch (error) {
            console.error('❌ Ошибка парсинга:', error);
          }
        }
        setIsRestoringFromStorage(false);
      }, 100);
    }
  }, [locations]);

  useEffect(() => {
    const savedResults = sessionStorage.getItem('searchResults');
    if (savedResults) {
      setResults(JSON.parse(savedResults));
    }
  }, []);

  return {
    // Состояния
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
    maxPosts,
    
    // Сеттеры
    setSelectedLocations,
    setCountrySearchText,
    setCitySearchText,
    setShowCountryDropdown,
    setShowCityDropdown,
    setLocationSearchText,
    setMaxPosts,
    
    // Обработчики
    handleCountryChange,
    handleCityChange,
    handleSearchInfluencers: () => handleSearch(false),
    handleForceRefresh: () => handleSearch(true),
    handleContinueParsing,
    handleParseCity,
    handleParseProfile,

    // Фильтры
    minFollowers,
    maxFollowers,
    locationFilter,
    minReelsViews,
    setMinFollowers,
    setMaxFollowers,
    setLocationFilter,
    setMinReelsViews
  };
};