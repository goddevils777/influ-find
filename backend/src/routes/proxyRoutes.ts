import { Router, Request, Response } from 'express';
import { authenticateToken } from './authRoutes';
import { UserService } from '../services/userService';
import { log } from '../utils/helpers';
import axios from 'axios';

const router = Router();
const userService = new UserService();

interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'http' | 'https' | 'socks5';
}

// Подключение прокси
router.post('/connect', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const proxyConfig: ProxyConfig = req.body;
    
    // Валидация данных
    if (!proxyConfig.host || !proxyConfig.port) {
      return res.status(400).json({
        success: false,
        message: 'Хост и порт обязательны для заполнения'
      });
    }

    log(`🔗 Пользователь ${req.user.email} подключает прокси ${proxyConfig.host}:${proxyConfig.port}`);

    // Тестируем прокси перед сохранением
    const testResult = await testProxyConnection(proxyConfig);
    
    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        message: `Прокси не работает: ${testResult.error}`
      });
    }

    // Сохраняем конфигурацию прокси
    const updated = await userService.updateProxyStatus(userId, true, proxyConfig);
    
    if (updated) {
      log(`✅ Прокси подключен для пользователя ${req.user.email}: ${proxyConfig.host}:${proxyConfig.port}`);
      res.json({
        success: true,
        message: 'Прокси успешно подключен',
        ip: testResult.ip,
        country: testResult.country
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Ошибка сохранения настроек прокси'
      });
    }

  } catch (error) {
    log(`❌ Ошибка подключения прокси: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Отключение прокси
router.post('/disconnect', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    log(`🔌 Пользователь ${req.user.email} отключает прокси`);

    // Отключаем только прокси, НЕ Instagram
    await userService.updateProxyStatus(userId, false);
    
    res.json({
      success: true,
      message: 'Прокси отключен. Instagram аккаунт остается подключен.'
    });

  } catch (error) {
    log(`❌ Ошибка отключения прокси: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Ошибка отключения прокси'
    });
  }
});

// Тестирование прокси
router.post('/test', authenticateToken, async (req: any, res: Response) => {
  try {
    const proxyConfig: ProxyConfig = req.body;
    
    if (!proxyConfig.host || !proxyConfig.port) {
      return res.status(400).json({
        success: false,
        message: 'Хост и порт обязательны для тестирования'
      });
    }

    log(`🧪 Тестирование прокси ${proxyConfig.host}:${proxyConfig.port}`);

    const testResult = await testProxyConnection(proxyConfig);
    
    if (testResult.success) {
      res.json({
        success: true,
        message: 'Прокси работает корректно',
        ip: testResult.ip,
        country: testResult.country
      });
    } else {
      res.status(400).json({
        success: false,
        message: testResult.error
      });
    }

  } catch (error) {
    log(`❌ Ошибка тестирования прокси: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Ошибка тестирования прокси'
    });
  }
});

// Получение статуса прокси
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
      connected: user.proxyConnected,
      config: user.proxyConfig ? {
        host: user.proxyConfig.host,
        port: user.proxyConfig.port,
        type: user.proxyConfig.type,
        // Не возвращаем пароли из соображений безопасности
        hasAuth: !!(user.proxyConfig.username && user.proxyConfig.password)
      } : null
    });

  } catch (error) {
    log(`❌ Ошибка получения статуса прокси: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статуса'
    });
  }
});

// Тестирование Instagram через прокси
router.post('/test-instagram', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const user = await userService.getUserById(userId);
    
    if (!user || !user.proxyConnected || !user.proxyConfig) {
      return res.status(400).json({
        success: false,
        message: 'Прокси не подключен. Сначала подключите прокси.'
      });
    }

    log(`🧪 Тестируем Instagram через прокси для пользователя ${req.user.email}`);

    // Тестируем доступ к Instagram через прокси
    const testResult = await testInstagramThroughProxy(user.proxyConfig);
    
    res.json(testResult);

  } catch (error) {
    log(`❌ Ошибка тестирования Instagram через прокси: ${error}`, 'error');
    res.status(500).json({
      success: false,
      message: 'Ошибка тестирования Instagram'
    });
  }
});

// Вспомогательная функция для тестирования прокси
async function testProxyConnection(proxyConfig: ProxyConfig): Promise<{
  success: boolean;
  ip?: string;
  country?: string;
  error?: string;
}> {
  try {
    // Формируем URL прокси
    let proxyUrl = `${proxyConfig.type}://`;
    
    if (proxyConfig.username && proxyConfig.password) {
      proxyUrl += `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@`;
    }
    
    proxyUrl += `${proxyConfig.host}:${proxyConfig.port}`;

    // Создаем axios инстанс с прокси
    const axiosWithProxy = axios.create({
      proxy: false, // Отключаем автоматический прокси
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    // Добавляем прокси в конфигурацию
    const config = {
      proxy: {
        protocol: proxyConfig.type,
        host: proxyConfig.host,
        port: proxyConfig.port,
        auth: proxyConfig.username && proxyConfig.password ? {
          username: proxyConfig.username,
          password: proxyConfig.password
        } : undefined
      }
    };

    // Тестируем подключение через прокси
    const response = await axiosWithProxy.get('http://httpbin.org/ip', config);
    
    if (response.data && response.data.origin) {
      const ip = response.data.origin;
      
      // Получаем информацию о стране (опционально)
      let country = 'Unknown';
      try {
        const geoResponse = await axiosWithProxy.get(`http://ip-api.com/json/${ip}`, config);
        if (geoResponse.data && geoResponse.data.country) {
          country = geoResponse.data.country;
        }
      } catch (geoError) {
        // Игнорируем ошибки получения геолокации
      }

      log(`✅ Прокси тест успешен: IP ${ip}, Страна: ${country}`);
      return {
        success: true,
        ip: ip,
        country: country
      };
    } else {
      return {
        success: false,
        error: 'Не удалось получить IP адрес через прокси'
      };
    }

  } catch (error: any) {
    let errorMessage = 'Неизвестная ошибка';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Подключение отклонено. Проверьте хост и порт.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Время ожидания истекло. Прокси не отвечает.';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Хост не найден. Проверьте адрес прокси.';
    } else if (error.response?.status === 407) {
      errorMessage = 'Ошибка авторизации. Проверьте логин и пароль.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    log(`❌ Прокси тест неудачен: ${errorMessage}`, 'error');
    return {
      success: false,
      error: errorMessage
    };
  }
}
// Функция тестирования Instagram через прокси
async function testInstagramThroughProxy(proxyConfig: ProxyConfig): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  
  puppeteer.use(StealthPlugin());
  
  let browser = null;
  
  try {
    // Формируем параметры запуска браузера с прокси
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    };

    // Для SOCKS5 с авторизацией используем другой подход
    if (proxyConfig.type === 'socks5') {
      if (proxyConfig.username && proxyConfig.password) {
        // SOCKS5 с авторизацией - используем HTTP туннель
        log('⚠️ SOCKS5 с авторизацией через Puppeteer ограничен, переходим на HTTP тест...');
        
        // Тестируем через axios с SOCKS агентом
        const testResult = await testSocks5Proxy(proxyConfig);
        if (!testResult.success) {
          throw new Error(testResult.error || 'SOCKS5 прокси не работает');
        }
        
        return {
          success: true,
          message: `SOCKS5 прокси работает! IP: ${testResult.ip}. Instagram должен быть доступен.`,
          details: {
            proxyTested: true,
            ip: testResult.ip,
            country: testResult.country,
            note: 'SOCKS5 протестирован через альтернативный метод'
          }
        };
      } else {
        // SOCKS5 без авторизации
        launchOptions.args.push(`--proxy-server=socks5://${proxyConfig.host}:${proxyConfig.port}`);
      }
    } else {
      // HTTP/HTTPS прокси
      launchOptions.args.push(`--proxy-server=${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`);
    }

    log(`🚀 Запускаем браузер с прокси: ${JSON.stringify(launchOptions.args)}`);

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Для HTTP/HTTPS прокси с авторизацией
    if ((proxyConfig.type === 'http' || proxyConfig.type === 'https') && 
        proxyConfig.username && proxyConfig.password) {
      await page.authenticate({
        username: proxyConfig.username,
        password: proxyConfig.password
      });
    }

    // Устанавливаем User-Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    log('🔍 Проверяем доступ к Instagram...');
    
    // Сначала проверяем можем ли вообще выйти в интернет через прокси
    try {
      await page.goto('https://httpbin.org/ip', { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      });
      
      const ipInfo = await page.evaluate(() => {
        try {
          return JSON.parse(document.body.innerText);
        } catch {
          return { origin: 'unknown' };
        }
      });
      
      log(`✅ Прокси работает! Внешний IP: ${ipInfo.origin}`);
    } catch (ipError) {
      log(`❌ Прокси не работает для обычных сайтов: ${ipError}`, 'error');
      throw new Error(`Прокси не работает: ${ipError instanceof Error ? ipError.message : String(ipError)}`);
    }
    
    // Теперь проверяем Instagram
    await page.goto('https://www.instagram.com/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Проверяем что страница загрузилась
    const mainPageTest = await page.evaluate(() => {
      return {
        title: document.title,
        hasInstagramElements: !!document.querySelector('div[role="main"]') || 
                            !!document.querySelector('article') ||
                            document.body.innerText.toLowerCase().includes('instagram'),
        bodyText: document.body.innerText.substring(0, 500),
        url: window.location.href
      };
    });

    if (!mainPageTest.hasInstagramElements) {
      log(`❌ Instagram не загрузился. Title: ${mainPageTest.title}`, 'error');
      log(`❌ Body text: ${mainPageTest.bodyText}`, 'error');
      throw new Error('Instagram главная страница не загрузилась через прокси');
    }

    log('✅ Главная страница Instagram доступна');

    // Проверяем доступ к локациям
    await page.goto('https://www.instagram.com/explore/locations/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    const locationsTest = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return {
        hasBlockedMessage: bodyText.includes('429') || bodyText.includes('blocked') || bodyText.includes('rate limit'),
        hasLocationsContent: bodyText.toLowerCase().includes('locations') || bodyText.toLowerCase().includes('places'),
        statusIndicators: {
          has429: bodyText.includes('429'),
          hasBlocked: bodyText.includes('blocked'),
          hasRateLimit: bodyText.includes('rate limit')
        },
        bodyText: bodyText.substring(0, 300)
      };
    });

    log(`📍 Проверка локаций: ${JSON.stringify(locationsTest)}`);

    if (locationsTest.hasBlockedMessage) {
      return {
        success: false,
        message: 'Instagram блокирует доступ к локациям с этого прокси. Попробуйте другой прокси.',
        details: {
          mainPageAccessible: true,
          locationsBlocked: true,
          blockReasons: locationsTest.statusIndicators
        }
      };
    }

    log('✅ Страница локаций Instagram доступна');

    await browser.close();

    return {
      success: true,
      message: 'Instagram полностью доступен через прокси! Можно подключать аккаунт.',
      details: {
        mainPageAccessible: true,
        locationsAccessible: true,
        proxyWorking: true
      }
    };

  } catch (error: any) {
    if (browser) {
      await browser.close();
    }

    log(`❌ Тест Instagram провален: ${error.message}`, 'error');
    
    let errorMessage = error.message;
    
    if (error.message.includes('ERR_NO_SUPPORTED_PROXIES')) {
      errorMessage = 'Puppeteer не поддерживает этот тип прокси. Но прокси должен работать для парсинга.';
    } else if (error.message.includes('ERR_SOCKS_CONNECTION_FAILED')) {
      errorMessage = 'SOCKS5 прокси не отвечает. Проверьте настройки прокси или попробуйте другой сервер.';
    } else if (error.message.includes('ERR_PROXY_CONNECTION_FAILED')) {
      errorMessage = 'Не удается подключиться к прокси серверу. Проверьте хост, порт и авторизацию.';
    } else if (error.message.includes('ERR_TUNNEL_CONNECTION_FAILED')) {
      errorMessage = 'Прокси сервер отклонил подключение. Проверьте логин и пароль.';
    }
    
    return {
      success: false,
      message: `Ошибка доступа к Instagram: ${errorMessage}`,
      details: {
        error: error.message,
        proxyConfig: {
          host: proxyConfig.host,
          port: proxyConfig.port,
          type: proxyConfig.type
        }
      }
    };
  }
}

// Тестирование SOCKS5 прокси через отдельный метод
async function testSocks5Proxy(proxyConfig: ProxyConfig): Promise<{
  success: boolean;
  ip?: string;
  country?: string;
  error?: string;
}> {
  try {
    const { SocksProxyAgent } = require('socks-proxy-agent');
    
    let proxyUrl = `socks5://`;
    if (proxyConfig.username && proxyConfig.password) {
      proxyUrl += `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@`;
    }
    proxyUrl += `${proxyConfig.host}:${proxyConfig.port}`;
    
    const agent = new SocksProxyAgent(proxyUrl);
    
    const axiosWithProxy = axios.create({
      timeout: 10000,
      httpsAgent: agent,
      httpAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    const response = await axiosWithProxy.get('http://httpbin.org/ip');
    
    if (response.data && response.data.origin) {
      const ip = response.data.origin;
      
      let country = 'Unknown';
      try {
        const geoResponse = await axiosWithProxy.get(`http://ip-api.com/json/${ip}`);
        if (geoResponse.data && geoResponse.data.country) {
          country = geoResponse.data.country;
        }
      } catch (geoError) {
        // Игнорируем ошибки получения геолокации
      }

      log(`✅ SOCKS5 тест успешен: IP ${ip}, Страна: ${country}`);
      return {
        success: true,
        ip: ip,
        country: country
      };
    } else {
      return {
        success: false,
        error: 'Не удалось получить IP адрес через SOCKS5 прокси'
      };
    }

  } catch (error: any) {
    log(`❌ SOCKS5 тест неудачен: ${error.message}`, 'error');
    return {
      success: false,
      error: error.message
    };
  }
}

export default router;