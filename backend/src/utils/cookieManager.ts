// backend/src/utils/cookieManager.ts - ЗАМЕНИТЬ ВЕСЬ ФАЙЛ
import fs from 'fs';
import path from 'path';
import { Page } from 'puppeteer';
import { log } from './helpers';

export class CookieManager {
  private cookiePath: string;

  constructor(userId?: string) {
    if (userId) {
      // Путь к cookies пользователя
      this.cookiePath = path.join(__dirname, `../../data/users/${userId}/instagram_cookies.json`);
      log(`👤 CookieManager для пользователя ${userId}: ${this.cookiePath}`);
    } else {
      // Общий путь (для совместимости)
      this.cookiePath = path.join(__dirname, '../../data/instagram_cookies.json');
      log(`🌐 CookieManager общий: ${this.cookiePath}`);
    }
    
    // Создаем папку если её нет
    const dataDir = path.dirname(this.cookiePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      log(`📁 Создана папка: ${dataDir}`);
    }
  }

  async saveCookies(page: Page): Promise<void> {
    try {
      // Получаем все cookies с текущей страницы
      const cookies = await page.cookies();
      
      if (cookies.length === 0) {
        log('⚠️ No cookies to save', 'warn');
        return;
      }
      
      // Сохраняем cookies с меткой времени
      const cookieData = {
        cookies: cookies,
        savedAt: new Date().toISOString(),
        userAgent: await page.evaluate(() => navigator.userAgent)
      };
      
      fs.writeFileSync(this.cookiePath, JSON.stringify(cookieData, null, 2));
      log(`✅ Saved ${cookies.length} cookies with timestamp`);
      
      // Выводим важные cookies для отладки
      const importantCookies = cookies.filter(c => 
        ['sessionid', 'ds_user_id', 'csrftoken'].includes(c.name)
      );
      
      if (importantCookies.length > 0) {
        log(`🔑 Important cookies saved: ${importantCookies.map(c => c.name).join(', ')}`);
      } else {
        log('⚠️ No critical Instagram cookies found', 'warn');
      }
      
    } catch (error) {
      log(`❌ Error saving cookies: ${error}`, 'error');
    }
  }

  async loadCookies(page: Page): Promise<boolean> {

  log(`🔍 DEBUG: Загружаем cookies`);
  log(`🔍 DEBUG: Путь к cookies: ${this.cookiePath}`);
    try {
      if (!fs.existsSync(this.cookiePath)) {
        log('📝 No saved cookies found');
        return false;
      }

      const cookieFileContent = fs.readFileSync(this.cookiePath, 'utf8');
      const cookieData = JSON.parse(cookieFileContent);
      
      // Проверяем формат файла
      let cookies;
      if (cookieData.cookies && Array.isArray(cookieData.cookies)) {
        // Новый формат с меткой времени
        cookies = cookieData.cookies;
        log(`📅 Loading cookies saved at: ${cookieData.savedAt}`);
      } else if (Array.isArray(cookieData)) {
        // Старый формат - просто массив cookies
        cookies = cookieData;
        log('📄 Loading cookies in old format');
      } else {
        log('❌ Invalid cookie file format', 'error');
        return false;
      }
      
      if (!cookies || cookies.length === 0) {
        log('⚠️ Cookie file is empty', 'warn');
        return false;
      }
      
      // Фильтруем просроченные cookies
      const validCookies = cookies.filter((cookie: any) => {
        if (cookie.expires && cookie.expires !== -1) {
          const expiryTime = cookie.expires * 1000; // Переводим в миллисекунды
          const now = Date.now();
          
          if (expiryTime < now) {
            log(`⏰ Cookie ${cookie.name} expired, skipping`);
            return false;
          }
        }
        return true;
      });
      
      if (validCookies.length === 0) {
        log('❌ All cookies are expired', 'error');
        this.clearCookies();
        return false;
      }
      
      // Устанавливаем cookies
      await page.setCookie(...validCookies);
      
      log(`✅ Loaded ${validCookies.length}/${cookies.length} valid cookies`);
      
      // Проверяем наличие важных cookies
      const sessionCookie = validCookies.find((c: any) => c.name === 'sessionid');
      const userIdCookie = validCookies.find((c: any) => c.name === 'ds_user_id');
      
      if (sessionCookie && userIdCookie) {
        log(`🔑 Session cookies present: sessionid + ds_user_id (${userIdCookie.value})`);
        return true;
        
      } else {
        log(`🔍 DEBUG: Найденные cookies: ${cookies.map((c: any) => c.name).join(', ')}`);
log(`🔍 DEBUG: Ищем критичные cookies: sessionid, csrftoken`);
        log('⚠️ Missing critical session cookies', 'warn');
        
        return false;
      }
      
    } catch (error) {
      log(`❌ Error loading cookies: ${error}`, 'error');
      return false;
    }
  }
// В cookieManager.ts ЗАМЕНИТЬ метод isAuthValid:

async isAuthValid(page: Page): Promise<boolean> {
  try {
    log('🔍 Checking authentication validity...');
    
    // МЕДЛЕННО ПЕРЕХОДИМ НА ГЛАВНУЮ СТРАНИЦУ
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // ЖДЕМ ДОЛЬШЕ ДЛЯ ЗАГРУЗКИ
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // СКРОЛЛИМ КАК ЧЕЛОВЕК
    await page.evaluate(() => {
      window.scrollTo(0, 100);
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // БОЛЕЕ ДЕТАЛЬНАЯ ПРОВЕРКА
    const authCheck = await page.evaluate(() => {
      const checks = {
        hasLoginForm: !!document.querySelector('input[name="username"]'),
        hasLoginButton: !!document.querySelector('button[type="submit"]'),
        hasNavigation: !!document.querySelector('nav'),
        hasCreateButton: !!document.querySelector('svg[aria-label*="New post"], svg[aria-label*="Create"], a[href*="/create/"]'),
        hasHomeIcon: !!document.querySelector('svg[aria-label*="Home"], a[href="/"]'),
        hasProfileMenu: !!document.querySelector('img[alt*="profile picture"], [data-testid="user-avatar"]'),
        hasSearchBar: !!document.querySelector('input[placeholder*="Search"], input[aria-label*="Search"]'),
        hasStories: !!document.querySelector('[role="button"]:has(img), div[style*="circle"]'),
        bodyText: document.body.innerText.slice(0, 200),
        currentUrl: window.location.href,
        pageTitle: document.title
      };
      
      console.log('Detailed auth check:', checks);
      return checks;
    });

    log(`🔍 Detailed auth check:`);
    log(`   URL: ${authCheck.currentUrl}`);
    log(`   Title: ${authCheck.pageTitle}`);
    log(`   Has login form: ${authCheck.hasLoginForm}`);
    log(`   Has navigation: ${authCheck.hasNavigation}`);
    log(`   Has create button: ${authCheck.hasCreateButton}`);
    log(`   Has home icon: ${authCheck.hasHomeIcon}`);
    log(`   Has profile menu: ${authCheck.hasProfileMenu}`);
    log(`   Has stories: ${authCheck.hasStories}`);
    log(`   Body text: ${authCheck.bodyText.slice(0, 100)}...`);

    // БОЛЕЕ СТРОГАЯ ПРОВЕРКА АВТОРИЗАЦИИ
    const isAuthenticated = !authCheck.hasLoginForm && 
                          (authCheck.hasNavigation || 
                           authCheck.hasCreateButton || 
                           authCheck.hasProfileMenu ||
                           authCheck.hasStories);

    // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ПО URL
    const urlCheck = !authCheck.currentUrl.includes('/accounts/login/') &&
                     !authCheck.currentUrl.includes('/accounts/signup/');

    const finalAuth = isAuthenticated && urlCheck;

    if (finalAuth) {
      log('✅ Authentication is valid!');
    } else {
      log('❌ Authentication is invalid - login required');
      log(`   URL check: ${urlCheck}`);
      log(`   Auth indicators: ${isAuthenticated}`);
    }

    return finalAuth;
    
  } catch (error) {
    log(`❌ Cookie validation error: ${error}`, 'error');
    return false;
  }
}

  clearCookies(): void {
    try {
      if (fs.existsSync(this.cookiePath)) {
        fs.unlinkSync(this.cookiePath);
        log('🗑️ Cleared saved cookies');
      }
    } catch (error) {
      log(`❌ Error clearing cookies: ${error}`, 'error');
    }
  }

  // Новый метод для проверки возраста cookies
  getCookieAge(): number | null {
    try {
      if (!fs.existsSync(this.cookiePath)) {
        return null;
      }

      const cookieFileContent = fs.readFileSync(this.cookiePath, 'utf8');
      const cookieData = JSON.parse(cookieFileContent);
      
      if (cookieData.savedAt) {
        const savedTime = new Date(cookieData.savedAt).getTime();
        const now = Date.now();
        const ageInHours = (now - savedTime) / (1000 * 60 * 60);
        return ageInHours;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}