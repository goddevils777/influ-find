// frontend/src/hooks/useSearchForm.ts
import { useState, useEffect } from 'react';
import axios from 'axios';
import { SearchResponse, ProfileResponse, Country, City, Location } from '../types/api';

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
      setSelectedCity('');
      setLocations([]);
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

  // Handlers
  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    
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

  const handleSearchInfluencers = async () => {
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
        guestMode: true
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

  const handleForceRefresh = async () => {
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

  // Парсинг отдельного профиля
  const handleParseProfile = async (username: string) => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`🔍 Парсинг профиля @${username}`);
      
      const response = await axios.post<ProfileResponse>('http://localhost:3001/api/search/profile', {
        username: username
        // Убираем guestMode - используем авторизованный режим
      });
      
      if (response.data.success && results) {
        // Обновляем данные инфлюенсера в результатах
        const updatedInfluencers = results.data.influencers.map((inf) => 
          inf.username === username ? { ...inf, ...response.data.data } : inf
        );
        
        setResults({
          ...results,
          data: {
            ...results.data,
            influencers: updatedInfluencers
          }
        });
        
        return response.data.data;
      }
    } catch (error) {
      setError(`Ошибка парсинга профиля @${username}`);
      console.error('Profile parse error:', error);
    } finally {
      setLoading(false);
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
    if (cities.length > 0) {
      const savedCity = sessionStorage.getItem('selectedCity');
      if (savedCity) {
        setSelectedCity(savedCity);
        const cityData = cities.find(city => city.id === savedCity);
        if (cityData) {
          setCitySearchText(cityData.name);
        }
        fetchLocations(savedCity);
      }
    }
  }, [cities]);

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
    // States
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
    
    // Handlers
    handleCountryChange,
    handleCityChange,
    handleParseCity,
    handleSearchInfluencers,
    handleForceRefresh,
    handleParseProfile
  };
};