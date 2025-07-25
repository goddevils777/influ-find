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
  let locationParser: LocationParser | null = null;
  
  try {
    const userId = req.user.userId;
    log(`🔗 Пользователь ${req.user.email} подключает Instagram аккаунт`);

    // Создаем парсер для авторизации
    locationParser = new LocationParser(false); // авторизованный режим
    
    // Открываем браузер для ручной авторизации
    await locationParser.init();
    
    log('✅ Браузер открыт для авторизации Instagram');
    log('🔐 Пользователь должен войти в Instagram в открывшемся браузере');

    // Отвечаем что процесс начат
    res.json({
      success: true,
      message: 'Браузер открыт для авторизации. Войдите в Instagram и нажмите Enter в терминале сервера.',
      status: 'browser_opened'
    });

    // В фоновом режиме ждем авторизации
    // (это упрощенная версия - в реальности нужен более сложный механизм)
    setTimeout(async () => {
      try {
        // Проверяем авторизацию
        const isConnected = await checkInstagramConnection(locationParser!);
        
        if (isConnected) {
          // Обновляем статус пользователя в базе
          await userService.updateInstagramStatus(userId, true, 'connected_user');
          log(`✅ Instagram подключен для пользователя ${req.user.email}`);
        }
      } catch (error) {
        log(`❌ Ошибка проверки подключения Instagram: ${error}`, 'error');
      } finally {
        if (locationParser) {
          await locationParser.close();
        }
      }
    }, 5000);

  } catch (error) {
    log(`❌ Ошибка подключения Instagram: ${error}`, 'error');
    
    if (locationParser) {
      await locationParser.close();
    }
    
    res.status(500).json({
      success: false,
      message: 'Ошибка подключения Instagram'
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