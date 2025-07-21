import { Page } from 'puppeteer';
import { delay, randomDelay, log } from '../utils/helpers';

export interface InstagramAccount {
  username: string;
  password: string;
  isActive: boolean;
  lastUsed: Date;
  blockedUntil?: Date;
}

export class InstagramAuth {
  private accounts: InstagramAccount[] = [];
  private currentAccountIndex: number = 0;

  constructor() {
    // Добавляем тестовые аккаунты из переменных окружения
    this.loadAccountsFromEnv();
  }

  private loadAccountsFromEnv(): void {
    // Загружаем аккаунты из .env файла
    const username1 = process.env.INSTAGRAM_USER_1;
    const password1 = process.env.INSTAGRAM_PASS_1;
    
    if (username1 && password1) {
      this.accounts.push({
        username: username1,
        password: password1,
        isActive: true,
        lastUsed: new Date(0)
      });
    }

    // Можно добавить больше аккаунтов
    const username2 = process.env.INSTAGRAM_USER_2;
    const password2 = process.env.INSTAGRAM_PASS_2;
    
    if (username2 && password2) {
      this.accounts.push({
        username: username2,
        password: password2,
        isActive: true,
        lastUsed: new Date(0)
      });
    }

    log(`Loaded ${this.accounts.length} Instagram accounts for parsing`);
  }

  async loginToInstagram(page: Page): Promise<boolean> {
  try {
    const account = this.getAvailableAccount();
    if (!account) {
      log('No available Instagram accounts for login', 'error');
      return false;
    }

    log(`Attempting login with account: ${account.username}`);

    // Переходим на страницу логина
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await delay(3000); // Увеличиваем задержку

    // Ждем появления формы логина
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });

    // Очищаем поля перед вводом
    await page.evaluate(() => {
      const usernameInput = document.querySelector('input[name="username"]') as HTMLInputElement;
      const passwordInput = document.querySelector('input[name="password"]') as HTMLInputElement;
      if (usernameInput) usernameInput.value = '';
      if (passwordInput) passwordInput.value = '';
    });

    await delay(1000);

    // Вводим логин
    await page.type('input[name="username"]', account.username, { delay: 150 });
    await randomDelay(1000, 2000);

    // Вводим пароль
    await page.type('input[name="password"]', account.password, { delay: 150 });
    await randomDelay(1000, 2000);

    // Нажимаем кнопку входа
    await page.click('button[type="submit"]');

    // Увеличиваем время ожидания
    await delay(5000);

    // Проверяем успешность входа
    const currentUrl = page.url();
    
    if (currentUrl.includes('/challenge/')) {
      log(`Login failed for ${account.username} - security challenge required`, 'error');
      this.markAccountAsBlocked(account);
      return this.tryNextAccount(page); // Пробуем следующий аккаунт
    }
    
    if (currentUrl.includes('/accounts/login/')) {
      log(`Login failed for ${account.username} - still on login page`, 'error');
      this.markAccountAsBlocked(account);
      return this.tryNextAccount(page);
    }

    // Успешный вход - обрабатываем модальные окна
    await this.handlePostLoginModals(page);

    account.lastUsed = new Date();
    log(`Successfully logged in with ${account.username}`);
    return true;

  } catch (error) {
    log(`Login error: ${error}`, 'error');
    return false;
  }
}

private async tryNextAccount(page: Page): Promise<boolean> {
  const nextAccount = this.getAvailableAccount();
  if (nextAccount) {
    log(`Trying next account: ${nextAccount.username}`);
    return this.loginToInstagram(page);
  }
  return false;
}

private async handlePostLoginModals(page: Page): Promise<void> {
  try {
    await delay(2000);
    
    // "Save Your Login Info" - Not Now
    const notNowButtons = await page.$$('button');
    for (const button of notNowButtons) {
      const text = await button.evaluate(el => el.textContent);
      if (text && text.includes('Not Now')) {
        await button.click();
        await delay(1000);
        break;
      }
    }
  } catch (e) {
    log('No post-login modals to handle', 'info');
  }
}

  private getAvailableAccount(): InstagramAccount | null {
    // Находим доступный аккаунт (не заблокированный)
    const now = new Date();
    
    for (let i = 0; i < this.accounts.length; i++) {
      const account = this.accounts[this.currentAccountIndex];
      
      if (account.isActive && (!account.blockedUntil || account.blockedUntil < now)) {
        this.currentAccountIndex = (this.currentAccountIndex + 1) % this.accounts.length;
        return account;
      }
      
      this.currentAccountIndex = (this.currentAccountIndex + 1) % this.accounts.length;
    }
    
    return null;
  }

  private markAccountAsBlocked(account: InstagramAccount): void {
    account.isActive = false;
    account.blockedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // Блокируем на 2 часа
    log(`Account ${account.username} marked as blocked until ${account.blockedUntil}`);
  }

  getAccountsStatus(): { total: number; active: number; blocked: number } {
    const now = new Date();
    const active = this.accounts.filter(acc => acc.isActive && (!acc.blockedUntil || acc.blockedUntil < now)).length;
    const blocked = this.accounts.filter(acc => !acc.isActive || (acc.blockedUntil && acc.blockedUntil > now)).length;
    
    return {
      total: this.accounts.length,
      active,
      blocked
    };
  }
}