import { Page } from 'puppeteer';
import { delay, randomDelay, log } from './helpers';

export class InstagramHandler {
  
  static async handleLoginPrompt(page: Page): Promise<boolean> {
    try {
      // Проверяем есть ли форма логина
      const loginForm = await page.$('form[id="loginForm"]');
      if (loginForm) {
        log('Instagram login required - using guest mode', 'warn');
        
        // Пытаемся закрыть модальное окно логина
        const closeButton = await page.$('button[aria-label="Close"]');
        if (closeButton) {
          await closeButton.click();
          await delay(1000);
        }
        
        // Можно попробовать кликнуть "Not now" если есть
        const notNowButton = await page.$('button:contains("Not Now")');
        if (notNowButton) {
          await notNowButton.click();
          await delay(1000);
        }
      }
      
      return true;
    } catch (error) {
      log(`Error handling login prompt: ${error}`, 'warn');
      return false;
    }
  }
  
  static async checkForBlocking(page: Page): Promise<boolean> {
    try {
      const url = page.url();
      
      // Проверяем на блокировку или капчу
      if (url.includes('challenge') || url.includes('blocked')) {
        log('Instagram blocking detected', 'error');
        return true;
      }
      
      // Проверяем на тексты блокировки
      const pageText = await page.evaluate(() => document.body.innerText);
      const blockingKeywords = [
        'temporarily blocked',
        'unusual activity',
        'verify your account',
        'rate limit'
      ];
      
      for (const keyword of blockingKeywords) {
        if (pageText.toLowerCase().includes(keyword)) {
          log(`Blocking detected: ${keyword}`, 'error');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      log(`Error checking for blocking: ${error}`, 'warn');
      return false;
    }
  }
  
  static async humanLikeScroll(page: Page): Promise<void> {
    try {
      // Имитируем человеческое поведение - скроллинг
      await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 300 + 100);
      });
      
      await randomDelay(500, 1500);
      
      await page.evaluate(() => {
        window.scrollBy(0, -(Math.random() * 100 + 50));
      });
      
      await randomDelay(300, 800);
    } catch (error) {
      log(`Error during human-like scroll: ${error}`, 'warn');
    }
  }
  
  static async waitForPageLoad(page: Page, timeout: number = 30000): Promise<boolean> {
    try {
      await page.waitForSelector('body', { timeout });
      await delay(1000);
      
      // Проверяем что страница загрузилась
      const isLoaded = await page.evaluate(() => {
        return document.readyState === 'complete';
      });
      
      return isLoaded;
    } catch (error) {
      log(`Page load timeout or error: ${error}`, 'warn');
      return false;
    }
  }
}