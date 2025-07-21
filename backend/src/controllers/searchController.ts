import { Request, Response } from 'express';
import { InstagramParser } from '../parsers/instagram';
import { InfluencerService } from '../services/influencerService';
import { cacheService } from '../services/cacheService';
import { log } from '../utils/helpers';



export const searchByCity = async (req: Request, res: Response) => {
  try {
    log(`🔍 searchByCity вызвана с параметрами: ${JSON.stringify(req.body)}`);
    const { cityName, guestMode } = req.body;
    
    if (!cityName) {
      log(`❌ Не указано название города`);
      return res.status(400).json({ error: 'City name is required' });
    }

    log(`🔍 Ищем город: ${cityName}`);
    
    // ДОБАВЬ ПРОВЕРКУ ЕСТЬ ЛИ УЖЕ ЛОКАЦИИ ДЛЯ ГОРОДА
    log(`🔍 Импортируем LocationHierarchy...`);
    const { LocationHierarchy } = require('../parsers/locationHierarchy');
    const hierarchy = new LocationHierarchy();
    
    log(`🔍 Проверяем существующие локации для города: ${cityName}`);
    const existingLocations = hierarchy.getLocationsForCity(cityName);
    
    log(`🔍 Найдено существующих локаций: ${existingLocations.length}`);
    
    if (existingLocations.length > 0) {
      log(`✅ Найдены сохраненные локации для ${cityName}: ${existingLocations.length}`);
      return res.json({
        success: true,
        data: {
          city: cityName,
          locationsFound: existingLocations.length,
          message: 'Локации уже есть в базе данных',
          fromCache: true
        }
      });
    }

    log(`🔍 Проверяем кэш для города: ${cityName}`);
    const cacheKey = `city:${cityName.toLowerCase().trim()}${guestMode ? ':guest' : ''}`;
    
    // Проверяем кэш
    const cachedResult = cacheService.get(cacheKey);
    if (cachedResult) {
      log(`✅ Найден результат в кэше для ${cityName}`);
      return res.json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    log(`🔧 Создаем InfluencerService с guestMode: true`);
    // ПРИНУДИТЕЛЬНО ИСПОЛЬЗУЕМ ГОСТЕВОЙ РЕЖИМ
    const influencerService = new InfluencerService(true); // true = гостевой режим
    
    log(`🚀 Запускаем парсинг города: ${cityName}`);
    const influencers = await influencerService.getInfluencersByCity(cityName);
    
    log(`✅ Парсинг завершен. Найдено инфлюенсеров: ${influencers.length}`);
    
    const result = {
      city: cityName,
      influencers: influencers,
      status: 'completed',
      lastUpdated: new Date().toISOString(),
      mode: 'guest'
    };
    
    // Сохраняем в кэш
    log(`💾 Сохраняем результат в кэш`);
    cacheService.set(cacheKey, result);
    
    res.json({
      success: true,
      data: result,
      cached: false
    });
    
  } catch (error) {
    log(`❌ Критическая ошибка в searchByCity: ${error}`, 'error');
    if (error instanceof Error) {
      log(`❌ Детали ошибки: ${error.message}`, 'error');
      log(`❌ Stack trace: ${error.stack}`, 'error');
    }
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const getParserStatus = (req: Request, res: Response) => {
  const cacheStats = cacheService.getStats();
  
  // Получаем статус авторизации Instagram (если парсер инициализирован)
  let authStatus = { total: 0, active: 0, blocked: 0 };
  try {
    // Создаем временный экземпляр для получения статуса
    const { LocationParser } = require('../parsers/locationParser');
    const tempParser = new LocationParser();
    authStatus = tempParser.getAuthStatus();
  } catch (error) {
    log(`Error getting auth status: ${error}`, 'warn');
  }
  
  res.json({
    isRunning: false, // ЗАМЕНИ parser.getStatus() НА false
    cache: cacheStats,
    instagram: {
      accounts: authStatus,
      status: authStatus.active > 0 ? 'connected' : 'disconnected'
    }
  });
};

export const forceParseCity = async (req: Request, res: Response) => {
  try {
    const { cityName } = req.body;
    
    if (!cityName) {
      return res.status(400).json({ error: 'City name is required' });
    }

    log(`🔧 Создаем InfluencerService с guestMode: true для принудительного парсинга`);
    const influencerService = new InfluencerService(true); // СОЗДАЙ НОВЫЙ ЭКЗЕМПЛЯР
    const influencers = await influencerService.parseNewCity(cityName);
    
    res.json({
      success: true,
      data: {
        city: cityName,
        influencers: influencers,
        forced: true
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Force parse failed' 
    });
  }
};