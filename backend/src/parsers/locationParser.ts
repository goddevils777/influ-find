import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { PARSER_CONFIG } from '../config/parser';
import { delay, log } from '../utils/helpers';
import { CookieManager } from '../utils/cookieManager';
import { LocationHierarchy } from './locationHierarchy';

puppeteer.use(StealthPlugin());

export class LocationParser {
  private browser: any = null;
  public page: any = null;
  private cookieManager: CookieManager;
  private hierarchy: LocationHierarchy;
  private guestMode: boolean;

  constructor(guestMode: boolean = false) {
    this.cookieManager = new CookieManager();
    this.hierarchy = new LocationHierarchy();
    this.guestMode = guestMode;
  }

  async init(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }

      // УЛУЧШЕННЫЕ НАСТРОЙКИ БРАУЗЕРА ДЛЯ ОБХОДА ДЕТЕКЦИИ
      const launchOptions: any = {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-field-trial-config',
          '--disable-ipc-flooding-protection',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps',
          '--disable-popup-blocking',
          '--disable-prompt-on-repost',
          '--disable-hang-monitor',
          '--disable-sync',
          '--disable-translate',
          '--disable-plugins',
          '--disable-plugins-discovery',
          '--disable-prerender-local-predictor',
          '--disable-threaded-animation',
          '--disable-threaded-scrolling',
          '--disable-in-process-stack-traces',
          '--disable-histogram-customizer',
          '--disable-gl-extensions',
          '--disable-composited-antialiasing',
          '--disable-canvas-aa',
          '--disable-3d-apis',
          '--disable-accelerated-2d-canvas',
          '--disable-accelerated-jpeg-decoding',
          '--disable-accelerated-mjpeg-decode',
          '--disable-app-list-dismiss-on-blur',
          '--disable-accelerated-video-decode',
          '--window-size=1366,768',
          '--start-maximized'
        ]
      };

      this.browser = await puppeteer.launch(launchOptions);

    const context = await this.browser.createBrowserContext();
    this.page = await context.newPage();

    // ДОБАВЬ ЭТУ СТРОКУ:
    log('🔍 ОТЛАДКА: Страница создана, начинаем умную очистку...');

    // УМНАЯ ОЧИСТКА ДАННЫХ БРАУЗЕРА - только при сбросе сессии
    const fs = require('fs');
    const path = require('path');
    const resetFlagFile = path.join(__dirname, '../../data/browser_reset_needed.flag');
    const needsDeepReset = fs.existsSync(resetFlagFile);

    // ДОБАВЬ ЭТИ СТРОКИ ДЛЯ ОТЛАДКИ:
    log(`🔍 ОТЛАДКА: Путь к флагу: ${resetFlagFile}`);
    log(`🔍 ОТЛАДКА: Флаг существует: ${needsDeepReset}`);
    log(`🔍 ОТЛАДКА: Режим гостя: ${this.guestMode}`);

    if (needsDeepReset) {
        log('🔥 ОБНАРУЖЕН ФЛАГ СБРОСА - выполняем глубокую очистку для нового аккаунта');
        
        await this.page.evaluateOnNewDocument(() => {
          // ГЛУБОКАЯ ОЧИСТКА для смены аккаунта
          localStorage.clear();
          sessionStorage.clear();
          
          // Очищаем IndexedDB
          if (window.indexedDB) {
            window.indexedDB.databases().then(databases => {
              databases.forEach(db => {
                if (db.name) window.indexedDB.deleteDatabase(db.name);
              });
            });
          }
          
          // Переопределяем WebGL fingerprint
          const getParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel(R) HD Graphics 630';
            return getParameter.call(this, parameter);
          };
          
          // Маскируем canvas fingerprint
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function(...args) {
            const context = this.getContext('2d');
            if (context) {
              context.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.1)`;
              context.fillRect(0, 0, 1, 1);
            }
            return originalToDataURL.apply(this, args);
          };
          
          // Случайное разрешение экрана
          Object.defineProperty(screen, 'width', { get: () => 1366 + Math.floor(Math.random() * 200) });
          Object.defineProperty(screen, 'height', { get: () => 768 + Math.floor(Math.random() * 200) });
          
          // Удаляем WebDriver следы
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          
          // Случайные плагины
          Object.defineProperty(navigator, 'plugins', {
            get: () => new Array(Math.floor(Math.random() * 5) + 1).fill({})
          });
          
          // Случайный язык
          const languages = [['en-US', 'en'], ['en-GB', 'en'], ['en-CA', 'en']];
          const randomLang = languages[Math.floor(Math.random() * languages.length)];
          Object.defineProperty(navigator, 'languages', { get: () => randomLang });
          
          // Удаляем chrome объект
          if ('chrome' in window) delete (window as any).chrome;
        });
        
        // Удаляем флаг после использования
        fs.unlinkSync(resetFlagFile);
        log('🗑️ Флаг сброса удален - глубокая очистка выполнена');
        
      } else {
         log('✅ Используем существующую сессию - минимальная очистка');
        
        await this.page.evaluateOnNewDocument(() => {
          // МИНИМАЛЬНАЯ ОЧИСТКА для существующей сессии
          // Только убираем следы автоматизации
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
          if ('chrome' in window) delete (window as any).chrome;
        });
      }

      // Очищаем старые cookies только при глубоком сбросе
      if (needsDeepReset) {
        await this.page.deleteCookie(...(await this.page.cookies()));
        log('🗑️ Старые cookies очищены для нового аккаунта');
      }
      
      // УСТАНАВЛИВАЕМ РЕАЛИСТИЧНЫЙ USER-AGENT
      const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
      await this.page.setUserAgent(userAgent);
      
      // УСТАНАВЛИВАЕМ VIEWPORT
      await this.page.setViewport({ 
        width: 1366, 
        height: 768,
        deviceScaleFactor: 1
      });
      
      // УСТАНАВЛИВАЕМ ДОПОЛНИТЕЛЬНЫЕ ЗАГОЛОВКИ
      await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      });
      
      // АВТОРИЗАЦИЯ
      if (!this.guestMode) {
        log('🔍 Режим с авторизацией - проверяем сохраненную авторизацию...');
        const savedAuth = await this.checkSavedAuth();
        
        if (!savedAuth) {
          log('❌ Нет сохраненной авторизации - требуется ручная авторизация');
          await this.manualAuth();
        }
      } else {
        log('👤 Гостевой режим - пропускаем авторизацию');
      }
      
      log('LocationParser initialized successfully');
    } catch (error) {
      log(`Failed to initialize parser: ${error}`, 'error');
      throw error;
    }
  }

  private async checkSavedAuth(): Promise<boolean> {
    try {
      // Проверяем возраст cookies
      const cookieAge = this.cookieManager.getCookieAge();
      if (cookieAge !== null) {
        log(`📅 Cookie age: ${cookieAge.toFixed(1)} hours`);
        
        // Если cookies старше 24 часов, лучше их обновить
        if (cookieAge > 24) {
          log('⚠️ Cookies are quite old, might need refresh');
        }
      }
      
      const cookiesLoaded = await this.cookieManager.loadCookies(this.page);
      
      if (cookiesLoaded) {
        log('🔍 Проверяем сохраненную авторизацию...');
        
        // Дополнительная задержка для стабильности
        await delay(2000);
        
        const isValid = await this.cookieManager.isAuthValid(this.page);
        
        if (isValid) {
          log('✅ Сохраненная авторизация действительна! Логин не требуется.');
          return true;
        } else {
          log('❌ Сохраненная авторизация истекла или недействительна');
          // НЕ УДАЛЯЕМ cookies сразу, может быть временная проблема
          log('🔄 Попробуем использовать другой метод проверки...');
          
          // Альтернативная проверка - просто попробуем зайти на профильную страницу
          try {
            await this.page.goto('https://www.instagram.com/accounts/edit/', { 
              waitUntil: 'networkidle2',
              timeout: 15000 
            });
            
            const urlAfterRedirect = this.page.url();
            
            if (!urlAfterRedirect.includes('/accounts/login/')) {
              log('✅ Альтернативная проверка прошла - авторизация есть!');
              return true;
            } else {
              log('❌ Альтернативная проверка не прошла - требуется авторизация');
              this.cookieManager.clearCookies();
            }
          } catch (altError) {
            log(`⚠️ Альтернативная проверка не удалась: ${altError}`, 'warn');
            this.cookieManager.clearCookies();
          }
        }
      } else {
        log('📝 Сохраненных данных авторизации нет');
      }
      
      return false;
    } catch (error) {
      log(`❌ Ошибка проверки авторизации: ${error}`, 'error');
      return false;
    }
  }

  private async manualAuth(): Promise<void> {
    await this.page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    await delay(2000);
    
    log('='.repeat(60));
    log('🔐 АВТОРИЗАЦИЯ INSTAGRAM ТРЕБУЕТСЯ');
    log('1. Войдите в Instagram в открытом браузере');
    log('2. После успешного входа нажмите Enter в терминале');
    log('3. Авторизация сохранится для последующих использований');
    log('='.repeat(60));
    
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
    
    await this.page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle2'
    });
    
    const isAuth = await this.page.evaluate(() => {
      return !document.querySelector('input[name="username"]');
    });
    
    if (isAuth) {
      log('✅ Авторизация подтверждена! Сохраняем данные...');
      await this.cookieManager.saveCookies(this.page);
      log('💾 Авторизация сохранена. В следующий раз логин не потребуется!');
    } else {
      throw new Error('Авторизация не завершена');
    }
  }

  async findTopLocations(cityName: string): Promise<string[]> {
    try {
      if (!this.page) await this.init();
      
      log(`🔍 Поиск локаций для города: ${cityName}`);
      
      // Сначала проверяем есть ли уже сохраненные локации для этого города
      const savedLocations = this.hierarchy.getLocationsForCity(cityName);
      
      if (savedLocations.length > 0) {
        log(`✅ Найдено ${savedLocations.length} сохраненных локаций для ${cityName}`);
        return savedLocations.slice(0, 20); // Берем первые 20
      }
      
      // ЕСЛИ НЕТ ЛОКАЦИЙ - ИЩЕМ ГОРОД В БАЗЕ ГОРОДОВ И ПАРСИМ ЕГО
      log(`📝 Сохраненных локаций для ${cityName} не найдено, ищем в базе городов...`);
      
      // Проверяем есть ли город в базе украинских городов
      const fs = require('fs');
      const path = require('path');
      const citiesFile = path.join(__dirname, '../../data/locations/cities_UA.json');
      
      if (fs.existsSync(citiesFile)) {
        const cities = JSON.parse(fs.readFileSync(citiesFile, 'utf8'));
        const city = cities.find((c: any) => 
          c.name.toLowerCase() === cityName.toLowerCase() || 
          c.name.toLowerCase().includes(cityName.toLowerCase())
        );
        
        if (city) {
          log(`🏙️ Город ${cityName} найден в базе с ID: ${city.id}, URL: ${city.url}`);
          log(`🚀 Запускаем парсинг локаций по URL: ${city.url}`);
          
          // Парсим локации используя URL из базы данных
          try {
            await this.page.goto(city.url, {
              waitUntil: 'networkidle2',
              timeout: 30000
            });
            
            await delay(3000);
            
            // Проверяем что страница загрузилась
            const pageContent = await this.page.content();
            if (pageContent.includes('Ресурс (Page) недоступний') || pageContent.includes('неможливо завантажити')) {
              log('🚫 Instagram заблокировал доступ к локациям с этого IP', 'error');
              return [];
            }
            
            log(`📄 Страница города загружена успешно, начинаем парсинг локаций...`);
            
            // Запускаем парсинг локаций для города
            await this.hierarchy.parseLocationsInCity(this.page, city.id, city.name);
            
          } catch (error) {
            log(`❌ Ошибка загрузки страницы города ${city.url}: ${error}`, 'error');
            return [];
          }
          
          // После парсинга получаем локации снова
          const newLocations = this.hierarchy.getLocationsForCity(cityName);
          log(`✅ Спарсено ${newLocations.length} локаций для города ${cityName}`);
          
          return newLocations.slice(0, 20);
        }
      }
      
      log(`❌ Город ${cityName} не найден в базе данных`);
      return [];
      
    } catch (error) {
      log(`Ошибка поиска локаций: ${error}`, 'error');
      return [];
    }
  }

  // НОВЫЕ МЕТОДЫ ДЛЯ СОЗДАНИЯ БАЗЫ
  async createLocationDatabase(option: 'ukraine' | 'poland' | 'all'): Promise<void> {
    try {
      if (!this.page) await this.init();
      
      switch (option) {
        case 'ukraine':
          await this.createUkraineDatabase();
          break;
        case 'poland':
          await this.createPolandDatabase();
          break;
        case 'all':
          await this.createFullDatabase();
          break;
      }
      
    } catch (error) {
      log(`Ошибка создания базы: ${error}`, 'error');
      throw error;
    }
  }

  private async createUkraineDatabase(): Promise<void> {
    log('🇺🇦 Создаем базу локаций для Украины...');
    
    // Парсим города Украины
    const cities = await this.hierarchy.parseCitiesInCountry(this.page, 'UA', 'ukraine');
    
    // Ищем Киев в списке городов
    const kyiv = cities.find(city => 
      city.name.toLowerCase().includes('kyiv') || 
      city.name.toLowerCase().includes('киев')
    );
    
    if (kyiv) {
      log(`🏙️ Найден Киев: ${kyiv.name} (${kyiv.id})`);
      
      // Парсим все локации Киева
      await this.hierarchy.parseLocationsInCity(this.page, kyiv.id, kyiv.name);
      
      log('✅ База локаций для Киева создана!');
    } else {
      log('❌ Киев не найден в списке украинских городов');
    }
  }

  private async createPolandDatabase(): Promise<void> {
    log('🇵🇱 Создаем базу локаций для Польши...');
    
    const cities = await this.hierarchy.parseCitiesInCountry(this.page, 'PL', 'poland');
    
    // Ищем Варшаву
    const warsaw = cities.find(city => 
      city.name.toLowerCase().includes('warsaw') || 
      city.name.toLowerCase().includes('warszawa')
    );
    
    if (warsaw) {
      log(`🏙️ Найдена Варшава: ${warsaw.name} (${warsaw.id})`);
      await this.hierarchy.parseLocationsInCity(this.page, warsaw.id, warsaw.name);
      log('✅ База локаций для Варшавы создана!');
    }
  }

  private async createFullDatabase(): Promise<void> {
    log('🌍 Создаем полную базу всех стран (это займет много времени)...');
    
    // Сначала парсим все страны
    const countries = await this.hierarchy.parseCountries(this.page);
    
    log(`✅ Найдено ${countries.length} стран. База стран создана!`);
    log('Для создания полной базы городов и локаций используйте отдельные команды');
  }

  // Парсинг всех стран с главной страницы локаций
  async parseAllCountries(): Promise<void> {
    try {
      log('🌍 Переходим на главную страницу локаций Instagram...');
      
      await this.page.goto('https://www.instagram.com/explore/locations/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await delay(3000);
      
      // Парсим все страны на странице
      const countries = await this.hierarchy.parseCountries(this.page);
      
      log(`✅ Найдено и сохранено ${countries.length} стран в базу данных`);
      
    } catch (error) {
      log(`❌ Ошибка парсинга всех стран: ${error}`, 'error');
      throw error;
    }
  }

  // Парсинг всех городов выбранной страны (анонимно)
  async parseAllCitiesInCountry(countryCode: string, countryName: string): Promise<void> {
    try {
      log(`🏙️ Начинаем парсинг всех городов страны: ${countryName} (${countryCode})`);
      
      // Парсим все города в стране
      const cities = await this.hierarchy.parseCitiesInCountry(this.page, countryCode, countryName);
      
      log(`✅ Найдено и сохранено ${cities.length} городов для страны ${countryName}`);
      
    } catch (error) {
      log(`❌ Ошибка парсинга городов страны ${countryName}: ${error}`, 'error');
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      log('LocationParser закрыт');
    }
  }

  getAuthStatus() {
    return { manual: true, authenticated: true };
  }

  private async setupRandomHeaders(): Promise<void> {
    // Случайные заголовки как у реального браузера
    const headers = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,uk;q=0.8,ru;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': Math.random() > 0.5 ? '1' : '0', // Случайное Do Not Track
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    };

    await this.page.setExtraHTTPHeaders(headers);
    
    // Устанавливаем случайный timezone
    const timezones = [
      'Europe/Kiev', 'Europe/Warsaw', 'Europe/Berlin', 
      'America/New_York', 'Europe/London', 'Europe/Paris'
    ];
    const randomTZ = timezones[Math.floor(Math.random() * timezones.length)];
    
    await this.page.emulateTimezone(randomTZ);
    log(`🌍 Используем timezone: ${randomTZ}`);
  }

  private async checkForCaptcha(): Promise<boolean> {
    try {
      // Ищем признаки капчи или блокировки
      const captchaSelectors = [
        '[data-testid="challenge"]',
        '.challenge_box',
        'input[name="captcha"]',
        'iframe[title*="captcha"]',
        'div[class*="captcha"]'
      ];
      
      for (const selector of captchaSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          log('🚫 Обнаружена капча или блокировка!', 'warn');
          return true;
        }
      }
      
      // Проверяем текст на странице
      const pageText = await this.page.$eval('body', (el: any) => el.textContent).catch(() => '');
      const blockWords = ['challenge', 'captcha', 'blocked', 'temporarily unavailable'];
      
      if (blockWords.some(word => pageText.toLowerCase().includes(word))) {
        log('🚫 Обнаружена блокировка по тексту!', 'warn');
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
}