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

    // Также отключаем Instagram если был подключен
    await userService.updateInstagramStatus(userId, false);
    await userService.updateProxyStatus(userId, false);
    
    res.json({
      success: true,
      message: 'Прокси отключен. Instagram также отключен для безопасности.'
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

export default router;