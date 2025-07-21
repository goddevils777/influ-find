import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { PARSER_CONFIG } from '../config/parser';
import { delay, log } from '../utils/helpers';

puppeteer.use(StealthPlugin());

export class GuestParser {
  private browser: any = null;
  private page: any = null;

  async init(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--incognito' // Режим инкогнито
        ]
      });
      
      this.page = await this.browser.newPage();
      
      // Случайный User-Agent
      const userAgent = PARSER_CONFIG.userAgents[
        Math.floor(Math.random() * PARSER_CONFIG.userAgents.length)
      ];
      await this.page.setUserAgent(userAgent);
      
      log('GuestParser initialized (без авторизации)');
    } catch (error) {
      log(`Failed to initialize guest parser: ${error}`, 'error');
      throw error;
    }
  }

  async testLocationAccess(cityId: string = 'c2373594', cityName: string = 'kyiv'): Promise<boolean> {
    try {
      if (!this.page) await this.init();
      
      log('🧪 Тестируем доступ к локациям без авторизации...');
      
      // Тестируем страницу конкретной локации
      const testUrl = `https://www.instagram.com/explore/locations/${cityId}/${cityName}/?page=1`;
      
      await this.page.goto(testUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await delay(3000);
      
      // Проверяем статус страницы
      const pageStatus = await this.page.evaluate(() => {
        const bodyText = document.body.innerText;
        
        return {
          has429: bodyText.includes('429'),
          hasBlocked: bodyText.includes('blocked') || bodyText.includes('rate limit'),
          hasNotFound: bodyText.includes('Page Not Found'),
          hasLoginPrompt: !!document.querySelector('input[name="username"]'),
          hasLocations: document.querySelectorAll('a[href*="/explore/locations/"]').length,
          pageTitle: document.title
        };
      });
      
      log(`📊 Статус страницы без авторизации:`);
      log(`   - 429 ошибка: ${pageStatus.has429}`);
      log(`   - Заблокировано: ${pageStatus.hasBlocked}`);
      log(`   - Не найдено: ${pageStatus.hasNotFound}`);
      log(`   - Требует логин: ${pageStatus.hasLoginPrompt}`);
      log(`   - Найдено локаций: ${pageStatus.hasLocations}`);
      log(`   - Заголовок: ${pageStatus.pageTitle}`);
      
      // Если без авторизации доступ есть - это хороший знак
      if (!pageStatus.has429 && !pageStatus.hasBlocked && pageStatus.hasLocations > 0) {
        log('✅ Без авторизации страница локаций ДОСТУПНА!');
        return true;
      } else {
        log('❌ Без авторизации тоже заблокировано');
        return false;
      }
      
    } catch (error) {
      log(`Ошибка тестирования гостевого доступа: ${error}`, 'error');
      return false;
    }
  }

  async parseLocationsAsGuest(cityId: string, cityName: string): Promise<any[]> {
    try {
      if (!this.page) await this.init();
      
      log(`🔍 Парсим локации БЕЗ авторизации: ${cityName} (${cityId})`);
      
      const locations: any[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      
      while (hasMorePages && currentPage <= 5) { // Лимит для теста
        try {
          const url = `https://www.instagram.com/explore/locations/${cityId}/${cityName}/?page=${currentPage}`;
          
          log(`📄 Страница ${currentPage}: ${url}`);
          
          await this.page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          
          await delay(5000); // Увеличенная задержка
          
          // Проверяем статус
          const pageCheck = await this.page.evaluate(() => {
            const bodyText = document.body.innerText;
            return {
              isBlocked: bodyText.includes('429') || bodyText.includes('blocked'),
              locationsCount: document.querySelectorAll('a[href*="/explore/locations/"]').length
            };
          });
          
          if (pageCheck.isBlocked) {
            log(`❌ Страница ${currentPage} заблокирована`);
            hasMorePages = false;
            break;
          }
          
          // Извлекаем локации
          const pageLocations = await this.page.evaluate(() => {
            const locationLinks = Array.from(document.querySelectorAll('a[href*="/explore/locations/"]'));
            
            return locationLinks
              .map(link => {
                const href = link.getAttribute('href') || '';
                const text = link.textContent?.trim() || '';
                
                const locationMatch = href.match(/\/explore\/locations\/(\d+)\/([^\/]+)\//);
                
                if (locationMatch && !href.includes('/c') && locationMatch[1].length >= 6) {
                  return {
                    id: locationMatch[1],
                    name: text,
                    url: `https://www.instagram.com${href}`
                  };
                }
                return null;
              })
              .filter(location => location !== null);
          });
          
          log(`📍 Страница ${currentPage}: найдено ${pageLocations.length} локаций`);
          
          if (pageLocations.length === 0) {
            hasMorePages = false;
          } else {
            locations.push(...pageLocations);
            currentPage++;
          }
          
          // Большая пауза между страницами
          await delay(10000);
          
        } catch (error) {
          log(`Ошибка на странице ${currentPage}: ${error}`, 'error');
          hasMorePages = false;
        }
      }
      
      log(`✅ Гостевой парсинг завершен. Найдено ${locations.length} локаций`);
      return locations;
      
    } catch (error) {
      log(`Ошибка гостевого парсинга: ${error}`, 'error');
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      log('GuestParser закрыт');
    }
  }
}