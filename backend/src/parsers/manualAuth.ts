import { Page } from 'puppeteer';
import { delay, log } from '../utils/helpers';
import { CookieManager } from '../utils/cookieManager';

export class ManualInstagramAuth {
  private cookieManager: CookieManager;

  constructor() {
    this.cookieManager = new CookieManager();
  }

  async checkAuthStatus(page: Page): Promise<boolean> {
    try {
      // Сначала пробуем загрузить сохраненные cookies
      const cookiesLoaded = await this.cookieManager.loadCookies(page);
      
      if (cookiesLoaded) {
        log('Checking saved authentication...');
        const isValid = await this.cookieManager.isAuthValid(page);
        
        if (isValid) {
          log('✅ Using saved authentication - no manual login needed!');
          return true;
        } else {
          log('❌ Saved authentication expired');
          this.cookieManager.clearCookies();
        }
      }
      
      return false;
      
    } catch (error) {
      log(`Auth check error: ${error}`, 'error');
      return false;
    }
  }

  async waitForManualLogin(page: Page): Promise<boolean> {
  try {
    log('Opening Instagram for manual login...');
    
    // Переходим на страницу логина
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle2'
    });
    
    log('='.repeat(60));
    log('🔓 MANUAL LOGIN REQUIRED');
    log('1. Login to Instagram manually in the browser');
    log('2. After login, authentication will be saved automatically');
    log('3. System checks status every 10 seconds');
    log('⏱️  Take your time - no rush');
    log('='.repeat(60));
    
    // Ждем авторизацию
    let attempts = 0;
    
    while (attempts < 60) { // Максимум 10 минут
      await delay(10000);
      attempts++;
      
      try {
        // Проверяем что страница не детачилась
        if (page.isClosed()) {
          log('Page was closed, aborting', 'error');
          return false;
        }
        
        // Безопасная проверка URL
        let currentUrl;
        try {
          currentUrl = page.url();
        } catch (e) {
          log(`Frame detached, skipping check ${attempts}`, 'warn');
          continue;
        }
        
        // Проверяем авторизацию только если не на странице логина
        if (!currentUrl.includes('/accounts/login/')) {
          const isLoggedIn = await page.evaluate(() => {
            try {
              const hasLoginForm = document.querySelector('input[name="username"]');
              const hasUserElements = document.querySelector('nav') || 
                                    document.querySelector('[role="navigation"]') ||
                                    document.querySelector('svg[aria-label*="Home"]') ||
                                    document.querySelector('a[href="/"]');
              
              return !hasLoginForm && !!hasUserElements;
            } catch (e) {
              return false;
            }
          }).catch(() => false);
          
          if (isLoggedIn) {
            log('✅ Manual login detected! Saving authentication...');
            
            // Сохраняем cookies
            try {
              await this.cookieManager.saveCookies(page);
              log('🔒 Authentication saved successfully!');
            } catch (e) {
              log(`Cookie save failed: ${e}`, 'warn');
            }
            
            return true;
          }
        }
        
        if (attempts % 6 === 0) {
          log(`⏳ Attempt ${attempts}/60: Still waiting for login...`);
        }
        
      } catch (e) {
        log(`Check attempt ${attempts} failed: ${e}`, 'warn');
        continue;
      }
    }
    
    log('❌ Manual login timeout', 'error');
    return false;
    
  } catch (error) {
    log(`Manual login error: ${error}`, 'error');
    return false;
  }
}
}