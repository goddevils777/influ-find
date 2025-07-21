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

      // Настройка браузера
      const launchOptions: any = {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--start-maximized'
        ]
      };

      // В гостевом режиме добавляем инкогнито
      if (this.guestMode) {
        launchOptions.args.push('--incognito');
        log('🔒 Запуск в гостевом режиме (без авторизации)');
      }

      this.browser = await puppeteer.launch(launchOptions);
      
      this.page = await this.browser.newPage();
      
      // User-Agent
      const userAgent = PARSER_CONFIG.userAgents[
        Math.floor(Math.random() * PARSER_CONFIG.userAgents.length)
      ];
      await this.page.setUserAgent(userAgent);
      
      // Авторизация только если НЕ гостевой режим
      if (!this.guestMode) {
        const savedAuth = await this.checkSavedAuth();
        
        if (!savedAuth) {
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

  // Методы авторизации остаются без изменений
  private async checkSavedAuth(): Promise<boolean> {
    try {
      const cookiesLoaded = await this.cookieManager.loadCookies(this.page);
      
      if (cookiesLoaded) {
        log('🔍 Проверяем сохраненную авторизацию...');
        const isValid = await this.cookieManager.isAuthValid(this.page);
        
        if (isValid) {
          log('✅ Сохраненная авторизация действительна! Логин не требуется.');
          return true;
        } else {
          log('❌ Сохраненная авторизация истекла');
          this.cookieManager.clearCookies();
        }
      } else {
        log('📝 Сохраненных данных авторизации нет');
      }
      
      return false;
    } catch (error) {
      log(`Ошибка проверки авторизации: ${error}`, 'error');
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

  // НОВЫЙ ГЛАВНЫЙ МЕТОД - использует иерархию или сохраненные данные
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
      
      // Если нет сохраненных данных - предлагаем создать базу
      log(`📝 Сохраненных локаций для ${cityName} не найдено`);
      log('🔧 Необходимо создать базу локаций. Варианты:');
      log('1. Создать базу для Украины (рекомендуется)');
      log('2. Создать базу для Польши');
      log('3. Создать базу всех стран (долго)');
      
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
}