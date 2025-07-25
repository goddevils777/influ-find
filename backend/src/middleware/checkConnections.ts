import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/userService';
import { log } from '../utils/helpers';

const userService = new UserService();

export const requireProxyAndInstagram = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Пользователь не авторизован'
      });
    }

    const user = await userService.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }

    // Проверяем подключение прокси
    if (!user.proxyConnected) {
      log(`❌ Пользователь ${user.email} пытается запустить парсинг без прокси`);
      return res.status(403).json({
        success: false,
        error: 'Прокси не подключен',
        message: 'Для безопасности работы необходимо подключить прокси сервер. Перейдите в настройки и настройте прокси.',
        requiresProxy: true
      });
    }

    // Проверяем подключение Instagram
    if (!user.instagramConnected) {
      log(`❌ Пользователь ${user.email} пытается запустить парсинг без Instagram аккаунта`);
      return res.status(403).json({
        success: false,
        error: 'Instagram аккаунт не подключен',
        message: 'Необходимо подключить Instagram аккаунт для парсинга. Перейдите в настройки и подключите аккаунт.',
        requiresInstagram: true
      });
    }

    log(`✅ Пользователь ${user.email} имеет все необходимые подключения для парсинга`);
    
    // Добавляем информацию о пользователе в request
    req.userConfig = {
      proxyConfig: user.proxyConfig,
      instagramUsername: user.instagramUsername
    };

    next();
  } catch (error) {
    log(`❌ Ошибка проверки подключений: ${error}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
};

export const requireProxyOnly = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Пользователь не авторизован'
      });
    }

    const user = await userService.getUserById(userId);
    
    if (!user || !user.proxyConnected) {
      return res.status(403).json({
        success: false,
        error: 'Прокси не подключен',
        message: 'Для подключения Instagram необходим прокси. Сначала настройте прокси сервер.',
        requiresProxy: true
      });
    }

    req.userConfig = {
      proxyConfig: user.proxyConfig
    };

    next();
  } catch (error) {
    log(`❌ Ошибка проверки прокси: ${error}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
};