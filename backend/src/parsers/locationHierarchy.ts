import { Page } from 'puppeteer';
import { delay, log } from '../utils/helpers';
import { PARSER_CONFIG } from '../config/parser';
import fs from 'fs';
import path from 'path';
import { RequestTracker } from './requestTracker';

interface Country {
  code: string;
  name: string;
  url: string;
}

interface City {
  id: string;
  name: string;
  country: string;
  url: string;
}

interface Location {
  id: string;
  name: string;
  city: string;
  url: string;
}

export class LocationHierarchy {
  private dataPath = path.join(__dirname, '../../data/locations');
  private requestTracker: RequestTracker;
  
  constructor() {
    // Создаем папки для данных
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
    
    this.requestTracker = new RequestTracker();
  }

  // Шаг 1: Парсим все страны
  async parseCountries(page: Page): Promise<Country[]> {
    log('🌍 Начинаем парсинг всех стран...');
    
    const countries: Country[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && currentPage <= 10) { // Лимит страниц для безопасности
      try {
        log(`📄 Парсим страницу стран ${currentPage}...`);
        
        await page.goto(`https://www.instagram.com/explore/locations/?page=${currentPage}`, {
          waitUntil: 'networkidle2'
        });
        
        await delay(3000);
        
        // Извлекаем страны со страницы
        const pageCountries = await page.evaluate(() => {
          const countryLinks = Array.from(document.querySelectorAll('a[href*="/explore/locations/"]'));
          
          return countryLinks
            .map(link => {
              const href = link.getAttribute('href') || '';
              const text = link.textContent?.trim() || '';
              
              // Ищем ссылки на страны (формат: /explore/locations/XX/country-name/)
              const countryMatch = href.match(/\/explore\/locations\/([A-Z]{2})\/([^\/]+)\//);
              
              if (countryMatch) {
                return {
                  code: countryMatch[1],
                  name: text,
                  url: href
                };
              }
              return null;
            })
            .filter(country => country !== null);
        });
        
        log(`📍 На странице ${currentPage} найдено ${pageCountries.length} стран`);
        
        if (pageCountries.length === 0) {
          hasMorePages = false;
        } else {
          countries.push(...pageCountries);
          currentPage++;
        }
        
        await delay(2000);
        
      } catch (error) {
        log(`Ошибка парсинга страницы стран ${currentPage}: ${error}`, 'error');
        hasMorePages = false;
      }
    }
    
    // Сохраняем страны в файл
    const countriesFile = path.join(this.dataPath, 'countries.json');
    fs.writeFileSync(countriesFile, JSON.stringify(countries, null, 2));
    
    log(`✅ Парсинг стран завершен. Найдено ${countries.length} стран. Сохранено в ${countriesFile}`);
    
    return countries;
  }

  // Шаг 2: Парсим города в стране (Украина и Польша)
  async parseCitiesInCountry(page: Page, countryCode: string, countryName: string): Promise<City[]> {
    log(`🏙️ Начинаем парсинг городов в стране: ${countryName} (${countryCode})`);
    
    const cities: City[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && currentPage <= 50) { // Увеличиваем лимит
      try {
        log(`📄 Парсим страницу городов ${currentPage} для ${countryName}...`);
        
        const url = `https://www.instagram.com/explore/locations/${countryCode}/${countryName.toLowerCase()}/?page=${currentPage}`;
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        
        await delay(3000);
        
        // Проверяем что страница загрузилась корректно
        const pageExists = await page.evaluate(() => {
          return !document.body.innerText.includes('Page Not Found') && 
                 !document.body.innerText.includes('Sorry, this page isn\'t available');
        });
        
        if (!pageExists) {
          log(`📄 Страница ${currentPage} не существует, завершаем парсинг городов`);
          hasMorePages = false;
          break;
        }
        
        // Извлекаем города
        const pageCities = await page.evaluate((country) => {
          const cityLinks = Array.from(document.querySelectorAll('a[href*="/explore/locations/c"]'));
          
          return cityLinks
            .map(link => {
              const href = link.getAttribute('href') || '';
              const text = link.textContent?.trim() || '';
              
              // Ищем ссылки на города (формат: /explore/locations/c123456/city-name/)
              const cityMatch = href.match(/\/explore\/locations\/(c\d+)\/([^\/]+)\//);
              
              if (cityMatch) {
                return {
                  id: cityMatch[1],
                  name: text,
                  country: country,
                  url: `https://www.instagram.com${href}` // Полная ссылка
                };
              }
              return null;
            })
            .filter(city => city !== null);
        }, countryCode);
        
        log(`📍 На странице ${currentPage} найдено ${pageCities.length} городов`);
        
        if (pageCities.length === 0) {
          hasMorePages = false;
        } else {
          cities.push(...pageCities);
          currentPage++;
        }
        
        await delay(2000);
        
      } catch (error) {
        log(`Ошибка парсинга городов страницы ${currentPage}: ${error}`, 'error');
        hasMorePages = false;
      }
    }
    
    // Сохраняем города в файл
    const citiesFile = path.join(this.dataPath, `cities_${countryCode}.json`);
    fs.writeFileSync(citiesFile, JSON.stringify(cities, null, 2));
    
    log(`✅ Парсинг городов ${countryName} завершен. Найдено ${cities.length} городов`);
    
    // ВАЖНО: Теперь парсим локации для каждого города
    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];
      log(`🏙️ Парсим локации для города ${i + 1}/${cities.length}: ${city.name}`);
      
      try {
        // Проверяем что браузер все еще работает
        if (!page || page.isClosed()) {
          log('❌ Браузер закрыт, останавливаем парсинг', 'error');
          break;
        }
        
        await this.parseLocationsInCity(page, city.id, city.name);
        
        // Увеличенная пауза между городами
        await delay(PARSER_CONFIG.delays.betweenCities);
        
        // Логируем прогресс каждые 10 городов
        if ((i + 1) % 10 === 0) {
          log(`📊 Прогресс: обработано ${i + 1}/${cities.length} городов`);
        }
        
      } catch (error) {
        log(`❌ Ошибка парсинга локаций для города ${city.name}: ${error}`, 'error');
        
        // Если ошибка критическая (браузер закрылся) - останавливаемся
        if (error instanceof Error && error.message.includes('Target closed')) {
          log('❌ Браузер был закрыт, останавливаем парсинг всех городов', 'error');
          break;
        }
        
        // Иначе просто пропускаем этот город и продолжаем
        continue;
      }
    }
    
    return cities;
  }

  // Шаг 3: Парсим локации в городе (обновленная версия с полными ссылками)
  async parseLocationsInCity(page: Page, cityId: string, cityName: string): Promise<Location[]> {
    log(`📍 Начинаем парсинг локаций в городе: ${cityName} (${cityId})`);
    
    const locations: Location[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    
    while (hasMorePages && currentPage <= PARSER_CONFIG.limits.maxPagesPerCity) {
      try {
        // Проверяем нужна ли пауза
        await this.requestTracker.takeCooldownIfNeeded();
        
        log(`📄 Парсим страницу локаций ${currentPage} для ${cityName}...`);
        
        const url = `https://www.instagram.com/explore/locations/${cityId}/${cityName.toLowerCase()}/?page=${currentPage}`;
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // После page.goto добавь проверку:
        await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
        });

        // ДОБАВЬ ЭТУ ПРОВЕРКУ:
        const pageContent = await page.content();
        if (pageContent.includes('Ресурс (Page) недоступний') || pageContent.includes('неможливо завантажити')) {
        log('🚫 Instagram заблокировал доступ к локациям с этого IP', 'error');
        hasMorePages = false;
        break;
        }
        
        // Увеличиваем счетчик запросов
        this.requestTracker.incrementRequest();
        
        // Логируем прогресс запросов
        const stats = this.requestTracker.getStats();
        if (stats.currentRequests % 5 === 0) {
          log(`📊 Запросов: ${stats.currentRequests}/${PARSER_CONFIG.limits.requestsBeforeCooldown} (до паузы: ${stats.nextCooldownIn})`);
        }
        
        await delay(PARSER_CONFIG.delays.pageLoad);
        
        // Проверяем что страница существует
        const pageExists = await page.evaluate(() => {
          return !document.body.innerText.includes('Page Not Found') && 
                 !document.body.innerText.includes('Sorry, this page isn\'t available') &&
                 !document.body.innerText.includes('429');
        });
        
        if (!pageExists) {
          log(`📄 Страница локаций ${currentPage} не существует или заблокирована, завершаем парсинг`);
          hasMorePages = false;
          break;
        }
        
        // Извлекаем локации
        const pageLocations = await page.evaluate((city) => {
          const locationLinks = Array.from(document.querySelectorAll('a[href*="/explore/locations/"]'));
          
          return locationLinks
            .map(link => {
              const href = link.getAttribute('href') || '';
              const text = link.textContent?.trim() || '';
              
              // Ищем ссылки на конкретные локации (формат: /explore/locations/123456/location-name/)
              const locationMatch = href.match(/\/explore\/locations\/(\d+)\/([^\/]+)\//);
              
              if (locationMatch && !href.includes('/c') && locationMatch[1].length >= 6) {
                return {
                  id: locationMatch[1],
                  name: text,
                  city: city,
                  url: `https://www.instagram.com${href}` // Полная ссылка
                };
              }
              return null;
            })
            .filter(location => location !== null);
        }, cityName);
        
        log(`📍 На странице ${currentPage} найдено ${pageLocations.length} локаций`);
        
        if (pageLocations.length === 0) {
          hasMorePages = false;
        } else {
          locations.push(...pageLocations);
          currentPage++;
        }
        
        // Задержка между запросами
        await delay(PARSER_CONFIG.delays.betweenRequests);
        
      } catch (error) {
        log(`Ошибка парсинга локаций страницы ${currentPage}: ${error}`, 'error');
        
        // Проверяем на блокировку
        if (error instanceof Error && (error.message.includes('429') || error.message.includes('blocked'))) {
          log('🚫 Обнаружена блокировка, принудительная пауза 10 минут...', 'error');
          await delay(600000); // 10 минут
        }
        
        currentPage++;
        if (currentPage > 10) { 
          hasMorePages = false;
        }
      }
    }
    
    // ЗАМЕНИТЬ последнюю часть метода parseLocationsInCity (после парсинга всех страниц):

    // Финальная статистика
    const finalStats = this.requestTracker.getStats();
    log(`📊 Город ${cityName} завершен. Всего запросов в сессии: ${finalStats.totalRequests}`);

    // НОВАЯ ЛОГИКА: загружаем существующие локации и объединяем с новыми
    const sanitizedCityName = cityName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const locationsFile = path.join(this.dataPath, `locations_${cityId}_${sanitizedCityName}.json`);

    let existingLocations: Location[] = [];
    if (fs.existsSync(locationsFile)) {
    try {
        const existingData = fs.readFileSync(locationsFile, 'utf8');
        existingLocations = JSON.parse(existingData);
        log(`📋 Найдено ${existingLocations.length} существующих локаций для ${cityName}`);
    } catch (error) {
        log(`⚠️ Ошибка чтения существующих локаций: ${error}`, 'warn');
    }
    }

    // Объединяем существующие и новые локации, убираем дубликаты
    const allLocations = [...existingLocations];
    let newLocationsCount = 0;

    for (const newLocation of locations) {
    const exists = existingLocations.some(existing => existing.id === newLocation.id);
    if (!exists) {
        allLocations.push(newLocation);
        newLocationsCount++;
    }
    }

    log(`✅ Результат объединения:`);
    log(`   Было локаций: ${existingLocations.length}`);
    log(`   Найдено новых: ${locations.length}`);
    log(`   Добавлено уникальных: ${newLocationsCount}`);
    log(`   Итого локаций: ${allLocations.length}`);

    // Сохраняем объединенный список
    fs.writeFileSync(locationsFile, JSON.stringify(allLocations, null, 2));

    log(`✅ Парсинг локаций ${cityName} завершен. Сохранено ${allLocations.length} уникальных локаций`);

    return allLocations;
  }

  // Получить локации для города из сохраненных данных
  getLocationsForCity(cityName: string): string[] {
    try {
      if (!fs.existsSync(this.dataPath)) {
        return [];
      }

      const files = fs.readdirSync(this.dataPath);
      const locationFile = files.find(file => 
        file.includes('locations_') && 
        file.toLowerCase().includes(cityName.toLowerCase())
      );
      
      if (locationFile) {
        const data = fs.readFileSync(path.join(this.dataPath, locationFile), 'utf8');
        const locations: Location[] = JSON.parse(data);
        return locations.map(loc => loc.id);
      }
      
      return [];
    } catch (error) {
      log(`Ошибка получения локаций для ${cityName}: ${error}`, 'error');
      return [];
    }
  }

  // Метод для получения статистики запросов
  getRequestStats() {
    return this.requestTracker.getStats();
  }
}