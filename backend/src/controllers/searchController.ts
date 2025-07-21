import { Request, Response } from 'express';
import { InstagramParser } from '../parsers/instagram';
import { InfluencerService } from '../services/influencerService';
import { cacheService } from '../services/cacheService';
import { log } from '../utils/helpers';

const parser = new InstagramParser();
const influencerService = new InfluencerService();


export const searchByCity = async (req: Request, res: Response) => {
  try {
    const { cityName, guestMode } = req.body;
    
    if (!cityName) {
      return res.status(400).json({ error: 'City name is required' });
    }

    const cacheKey = `city:${cityName.toLowerCase().trim()}${guestMode ? ':guest' : ''}`;
    
    // Проверяем кэш
    const cachedResult = cacheService.get(cacheKey);
    if (cachedResult) {
      return res.json({
        success: true,
        data: cachedResult,
        cached: true
      });
    }

    // Получаем данные из сервиса с учетом режима
    const influencerService = new InfluencerService(guestMode || false);
    const influencers = await influencerService.getInfluencersByCity(cityName);
    
    const result = {
      city: cityName,
      influencers: influencers,
      status: 'completed',
      lastUpdated: new Date().toISOString(),
      mode: guestMode ? 'guest' : 'authenticated'
    };
    
    // Сохраняем в кэш
    cacheService.set(cacheKey, result);
    
    res.json({
      success: true,
      data: result,
      cached: false
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
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
    isRunning: parser.getStatus(),
    cache: cacheStats,
    instagram: {
      accounts: authStatus,
      status: authStatus.active > 0 ? 'authenticated' : 'not_authenticated'
    }
  });
};

export const forceParseCity = async (req: Request, res: Response) => {
  try {
    const { cityName } = req.body;
    
    if (!cityName) {
      return res.status(400).json({ error: 'City name is required' });
    }

    log(`Force parsing requested for city: ${cityName}`);
    
    // Очищаем кэш для этого города
    const cacheKey = `city:${cityName.toLowerCase().trim()}`;
    cacheService.delete(cacheKey);
    
    // Запускаем реальный парсинг
    const influencers = await influencerService.parseNewCity(cityName);
    
    const result = {
      city: cityName,
      influencers: influencers,
      status: 'completed',
      lastUpdated: new Date().toISOString(),
      source: 'real_parsing'
    };
    
    // Сохраняем в кэш
    cacheService.set(cacheKey, result);
    
    res.json({
      success: true,
      data: result,
      cached: false,
      message: `Successfully parsed ${influencers.length} influencers`
    });
    
  } catch (error) {
    log(`Force parse error: ${error}`, 'error');
    res.status(500).json({ 
      success: false, 
      error: 'Parsing failed. Please try again later.' 
    });
  }
};