import { Router, Request, Response } from 'express';
import { authenticateToken } from './authRoutes';
import { UserService } from '../services/userService';
import { LocationParser } from '../parsers/locationParser';
import { log } from '../utils/helpers';
import fs from 'fs';
import path from 'path';

const router = Router();
const userService = new UserService();

// Подключение Instagram аккаунта
router.post('/connect', authenticateToken, async (req: any, res: Response) => {
  let browser: any = null;
  let proxyUrl: string = '';
  let useProxyChain: boolean = false;
  
  try {
    const userId = req.user.userId;
    log(`🔗 Пользователь ${req.user.email} подключает Instagram аккаунт`);

    // Получаем настройки пользователя
    const user = await userService.getUserById(userId);
    
    if (!user || !user.proxyConnected || !user.proxyConfig) {
      return res.status(400).json({
        success: false,
        message: 'Для подключения Instagram необходим прокси. Сначала подключите прокси.'
      });
    }

    log(`🔗 Запускаем браузер через прокси ${user.proxyConfig.host}:${user.proxyConfig.port}`);

    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    const ProxyChain = require('proxy-chain');
    
    puppeteer.use(StealthPlugin());

    // Для SOCKS5 используем proxy-chain для конвертации в HTTP
    if (user.proxyConfig.type === 'socks5') {
      log('🔄 Конвертируем SOCKS5 в HTTP прокси через proxy-chain...');
      
      // Формируем SOCKS5 URL
      let socksUrl = 'socks5://';
      if (user.proxyConfig.username && user.proxyConfig.password) {
        socksUrl += `${encodeURIComponent(user.proxyConfig.username)}:${encodeURIComponent(user.proxyConfig.password)}@`;
      }
      socksUrl += `${user.proxyConfig.host}:${user.proxyConfig.port}`;
      
      log(`🔗 SOCKS5 URL: ${socksUrl}`);
      
      // Создаем HTTP прокси сервер который проксирует через SOCKS5
      proxyUrl = await ProxyChain.anonymizeProxy(socksUrl);
      useProxyChain = true;
      log(`✅ Создан локальный HTTP прокси: ${proxyUrl}`);
    } else {
  // Для HTTP/HTTPS прокси - НЕ включаем авторизацию в URL
  proxyUrl = `${user.proxyConfig.type}://${user.proxyConfig.host}:${user.proxyConfig.port}`;
}

// Формируем параметры запуска браузера
const launchOptions: any = {
  headless: false, // Показываем браузер для авторизации
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--start-maximized',
    `--proxy-server=${proxyUrl}`
  ]
};

log(`🚀 Запускаем браузер с прокси: ${proxyUrl}`);

browser = await puppeteer.launch(launchOptions);
const page = await browser.newPage();

// Для HTTP/HTTPS прокси ВСЕГДА используем authenticate
if ((user.proxyConfig.type === 'http' || user.proxyConfig.type === 'https') && 
    user.proxyConfig.username && user.proxyConfig.password) {
  await page.authenticate({
    username: user.proxyConfig.username,
    password: user.proxyConfig.password
  });
  log(`🔐 Настроена авторизация прокси: ${user.proxyConfig.username}`);
}

    // Устанавливаем User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    // Проверяем IP
    try {
      await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle2', timeout: 15000 });
      const ipInfo = await page.evaluate(() => {
        try {
          return JSON.parse(document.body.innerText);
        } catch {
          return { origin: 'unknown' };
        }
      });
      log(`🌐 Браузер использует IP: ${ipInfo.origin}`);
    } catch (ipError) {
      log(`⚠️ Не удалось проверить IP: ${ipError}`, 'warn');
    }

// Убираем все переходы на страницы локаций и логина
// Просто открываем главную страницу Instagram
log('🌐 Открываем главную страницу Instagram...');
await page.goto('https://www.instagram.com/', {
  waitUntil: 'networkidle2',
  timeout: 30000
});

// Небольшая пауза для загрузки
await new Promise(resolve => setTimeout(resolve, 3000));

// Проверяем что главная страница загрузилась
const mainPageInfo = await page.evaluate(() => {
  return {
    title: document.title,
    url: window.location.href,
    hasError: document.body.innerText.includes('429') || document.body.innerText.includes('не працює'),
    hasInstagramContent: document.body.innerText.toLowerCase().includes('instagram'),
    hasLoginButton: !!document.querySelector('a[href*="/accounts/login/"]')
  };
});

log(`📊 Главная страница Instagram: ${JSON.stringify(mainPageInfo)}`);

if (mainPageInfo.hasError) {
  log(`❌ Instagram блокирует прокси на главной странице`, 'error');
  
  await browser.close();
  
  return res.status(400).json({
    success: false,
    message: 'Instagram блокирует ваш прокси. Попробуйте другой прокси.',
    error: 'proxy_blocked'
  });
}

if (!mainPageInfo.hasInstagramContent) {
  log(`❌ Страница загрузилась некорректно`, 'error');
  
  await browser.close();
  
  return res.status(400).json({
    success: false,
    message: 'Страница Instagram загрузилась некорректно. Проверьте подключение.',
    error: 'page_load_error'
  });
}

log('✅ Главная страница Instagram загружена успешно');
log('🔐 Нажмите кнопку "Log in" в браузере и войдите в свой аккаунт');



    log('✅ Браузер открыт для авторизации Instagram через прокси');
    log('🔐 Войдите в Instagram в открывшемся браузере');

    // Отвечаем что процесс начат
    res.json({
      success: true,
      message: 'Браузер открыт через прокси. Войдите в Instagram, затем можете закрыть браузер.',
      status: 'browser_opened',
      proxyUsed: `${user.proxyConfig.host}:${user.proxyConfig.port}`
    });

    // Настраиваем сохранение cookies при изменении
    const cookiesPath = path.join(__dirname, `../../data/users/${userId}`);
    if (!fs.existsSync(cookiesPath)) {
      fs.mkdirSync(cookiesPath, { recursive: true });
    }

    // Проверяем авторизацию каждые 5 секунд
    const checkAuth = setInterval(async () => {
      try {
        const currentUrl = page.url();
        
        // Если пользователь ушел со страницы логина - значит авторизовался
        if (!currentUrl.includes('/accounts/login/')) {
          log('🎉 Пользователь авторизовался в Instagram!');
          

          // И замени на:
                    // Сохраняем cookies
          const cookies = await page.cookies();
          const instagramCookies = cookies.filter((cookie: any) => 
            cookie.domain.includes('instagram.com')
          );

          if (instagramCookies.length > 0) {
            // Сохраняем в том же формате что ожидает CookieManager
            const cookieData = {
              cookies: instagramCookies,
              savedAt: new Date().toISOString(),
              userAgent: await page.evaluate(() => navigator.userAgent)
            };
            
            fs.writeFileSync(
              path.join(cookiesPath, 'instagram_cookies.json'), 
              JSON.stringify(cookieData, null, 2)
            );
            
            // Проверяем критические cookies
            const criticalCookies = instagramCookies.filter((cookie: any) =>
              ['sessionid', 'ds_user_id', 'csrftoken'].includes(cookie.name)
            );
            
            log(`🔑 Сохранено cookies: ${instagramCookies.length} общих, ${criticalCookies.length} критических`);
            log(`🔑 Критические: ${criticalCookies.map((c: any) => c.name).join(', ')}`);
            
            // Обновляем статус пользователя в базе
            // Пытаемся получить имя пользователя из страницы
            let instagramUsername = 'connected_user';
            try {
              instagramUsername = await page.evaluate(() => {
                // Ищем имя пользователя в различных местах
                const usernameElement = document.querySelector('a[href^="/"][href$="/"]') ||
                                      document.querySelector('[data-testid="user-avatar"]') ||
                                      document.querySelector('header a[href^="/"]');
                return usernameElement?.getAttribute('href')?.replace(/\//g, '') || 'connected_user';
              });
            } catch (e) {
              // Игнорируем ошибки получения username
            }

            await userService.updateInstagramStatus(userId, true, instagramUsername);
            log(`✅ Instagram подключен для пользователя ${req.user.email} (@${instagramUsername}) - cookies сохранены`);
            
            clearInterval(checkAuth);
          }
        }
      } catch (error) {
        // Браузер закрыт или другая ошибка
        clearInterval(checkAuth);
      }
    }, 5000);

    // Очистка при закрытии браузера
    browser.on('disconnected', async () => {
      log('🔄 Браузер закрыт');
      clearInterval(checkAuth);
      
      if (useProxyChain && proxyUrl) {
        try {
          await ProxyChain.closeAnonymizedProxy(proxyUrl, true);
          log('🗑️ Локальный прокси сервер закрыт');
        } catch (error) {
          log(`⚠️ Ошибка закрытия прокси сервера: ${error}`, 'warn');
        }
      }
    });

  } catch (error: any) {
    log(`❌ Ошибка подключения Instagram: ${error}`, 'error');
    
    if (browser) {
      await browser.close();
    }
    
    if (useProxyChain && proxyUrl) {
      try {
        const ProxyChain = require('proxy-chain');
        await ProxyChain.closeAnonymizedProxy(proxyUrl, true);
      } catch (e) {
        // Игнорируем ошибки закрытия
      }
    }
    
    res.status(500).json({
      success: false,
      message: `Ошибка подключения Instagram: ${error?.message || 'Неизвестная ошибка'}`
    });
  }
});

// Отключение Instagram аккаунта
router.post('/disconnect', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    log(`🔌 Пользователь ${req.user.email} отключает Instagram аккаунт`);

    // Удаляем cookies Instagram для этого пользователя
    await clearInstagramSession(userId);
    
    // Обновляем статус в базе
    await userService.updateInstagramStatus(userId, false);
    
    res.json({
      success: true,
      message: 'Instagram аккаунт отключен'
    });

  } catch (error) {
    log(`❌ Ошибка отключения Instagram: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Ошибка отключения Instagram'
    });
  }
});

// Проверка статуса подключения
router.get('/status', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const user = await userService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }

    res.json({
      success: true,
      connected: user.instagramConnected,
      username: user.instagramUsername
    });

  } catch (error) {
    log(`❌ Ошибка проверки статуса Instagram: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Ошибка проверки статуса'
    });
  }
});

// Вспомогательные функции
async function checkInstagramConnection(parser: LocationParser): Promise<boolean> {
  try {
    // Проверяем можем ли получить доступ к авторизованным страницам Instagram
    await parser.page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    
    const isLoggedIn = await parser.page.evaluate(() => {
      // Ищем элементы которые показывают что пользователь авторизован
      return !document.querySelector('input[name="username"]') &&
             document.querySelector('[data-testid="user-avatar"]') !== null;
    });

    return isLoggedIn;
  } catch (error) {
    return false;
  }
}

async function clearInstagramSession(userId: string): Promise<void> {
  try {
    // Удаляем файл cookies для пользователя
    const cookiesPath = path.join(__dirname, `../../data/users/${userId}/instagram_cookies.json`);
    if (fs.existsSync(cookiesPath)) {
      fs.unlinkSync(cookiesPath);
      log(`🗑️ Cookies Instagram удалены для пользователя ${userId}`);
    }
  } catch (error) {
    log(`⚠️ Ошибка удаления cookies: ${error}`, 'warn');
  }
}

export default router;