import fs from 'fs';
import path from 'path';
import { Page } from 'puppeteer';
import { log } from './helpers';

export class CookieManager {
  private cookiePath = path.join(__dirname, '../../data/instagram_cookies.json');

  constructor() {
    // Создаем папку data если её нет
    const dataDir = path.dirname(this.cookiePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      log(`Created data directory: ${dataDir}`);
    }
    log(`Cookie path: ${this.cookiePath}`);
  }

  async saveCookies(page: Page): Promise<void> {
    try {
      const cookies = await page.cookies();
      fs.writeFileSync(this.cookiePath, JSON.stringify(cookies, null, 2));
      log(`Saved ${cookies.length} cookies to ${this.cookiePath}`);
    } catch (error) {
      log(`Error saving cookies: ${error}`, 'error');
    }
  }

  async loadCookies(page: Page): Promise<boolean> {
    try {
      if (!fs.existsSync(this.cookiePath)) {
        log('No saved cookies found');
        return false;
      }

      const cookiesData = fs.readFileSync(this.cookiePath, 'utf8');
      const cookies = JSON.parse(cookiesData);
      
      await page.setCookie(...cookies);
      log(`Loaded ${cookies.length} cookies from file`);
      return true;
    } catch (error) {
      log(`Error loading cookies: ${error}`, 'error');
      return false;
    }
  }

  async isAuthValid(page: Page): Promise<boolean> {
    try {
      await page.goto('https://www.instagram.com/', { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      });

        const isAuthenticated = await page.evaluate(() => {
        // Проверяем что нет формы логина
        const hasLoginForm = document.querySelector('input[name="username"]');
        
        // Проверяем наличие элементов авторизованного пользователя
        const hasProfileLink = document.querySelector('a[href*="/"]');
        const hasCreateButton = document.querySelector('svg[aria-label*="New post"], svg[aria-label*="Create"]');
        
        return !hasLoginForm && !!(hasProfileLink || hasCreateButton);
        });

      log(`Cookie auth validation: ${isAuthenticated ? 'valid' : 'invalid'}`);
      return isAuthenticated;
    } catch (error) {
      log(`Cookie validation error: ${error}`, 'error');
      return false;
    }
  }

  clearCookies(): void {
    try {
      if (fs.existsSync(this.cookiePath)) {
        fs.unlinkSync(this.cookiePath);
        log('Cleared saved cookies');
      }
    } catch (error) {
      log(`Error clearing cookies: ${error}`, 'error');
    }
  }
}