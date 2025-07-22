import { Router } from 'express';
import { Request, Response } from 'express';
import { searchByCity, getParserStatus, forceParseCity } from '../controllers/searchController';
import { log } from '../utils/helpers';

const router = Router();

// Существующие роуты
router.post('/city', searchByCity);
router.get('/status', getParserStatus);
router.post('/parse', forceParseCity);

// Поиск инфлюенсеров по выбранным локациям
router.post('/locations', async (req: Request, res: Response) => {
  let locationParser: any = null;
  
  try {
    const { cityName, cityId, locations, guestMode, forceRefresh } = req.body;
    
    if (!locations || locations.length === 0) {
      return res.status(400).json({ error: 'Locations are required' });
    }

    log(`🔍 Начинаем поиск инфлюенсеров в ${locations.length} локациях города ${cityName}`);
    log(`🔧 Принудительное обновление: ${forceRefresh ? 'ДА' : 'НЕТ'}`);
    
    // ПРОВЕРЯЕМ КЭШИ ВСЕХ ЛОКАЦИЙ ПЕРЕД СОЗДАНИЕМ ПАРСЕРА
    const { LocationCache } = require('../parsers/locationCache');
    const cache = new LocationCache();
    
    let allInfluencers: any[] = [];
    let locationsToProcess: any[] = [];
    
    // Проверяем какие локации есть в кэше
    for (const location of locations) {
      const locationId = location.id;
      
      if (!forceRefresh && cache.hasCache(locationId)) {
        const cachedInfluencers = cache.getCache(locationId);
        if (cachedInfluencers.length > 0) {
          log(`📋 Используем кэш для локации ${location.name}: ${cachedInfluencers.length} инфлюенсеров`);
          allInfluencers.push(...cachedInfluencers);
          continue;
        }
      }
      
      // Если кэша нет или принудительное обновление - добавляем в список для парсинга
      locationsToProcess.push(location);
    }
    
    log(`📊 Статистика: ${allInfluencers.length} из кэша, ${locationsToProcess.length} требуют парсинга`);
    
    // ЕСЛИ ВСЕ ЛОКАЦИИ В КЭШЕ - НЕ ОТКРЫВАЕМ БРАУЗЕР
    if (locationsToProcess.length === 0) {
      log(`✅ Все локации найдены в кэше, браузер не требуется`);
      
      const uniqueInfluencers = allInfluencers.filter((inf, index, self) => 
        index === self.findIndex(i => i.username === inf.username)
      );
      
      return res.json({
        success: true,
        data: {
          city: cityName,
          locationsSearched: locations.length,
          influencers: uniqueInfluencers,
          totalFound: uniqueInfluencers.length,
          fromCache: true
        }
      });
    }
    
    // СОЗДАЕМ ПАРСЕР ТОЛЬКО ДЛЯ ЛОКАЦИЙ БЕЗ КЭША
    const { PostParser } = require('../parsers/postParser');
    const { LocationParser } = require('../parsers/locationParser');
    
    log(`🔐 Создаем авторизованный парсер для ${locationsToProcess.length} локаций`);
    locationParser = new LocationParser(false);
    await locationParser.init();
    log(`✅ Парсер инициализирован успешно`);
    
    // Парсим только локации без кэша
    for (let i = 0; i < locationsToProcess.length; i++) {
      const location = locationsToProcess[i];
      
      try {
        log(`📍 Парсинг локации ${i + 1}/${locationsToProcess.length}: ${location.name}`);
        
        // ИСПРАВЛЯЕМ URL ЛОКАЦИИ
        let locationUrl = location.url;
        
        // Убираем /nearby/ если есть
        if (locationUrl.includes('/nearby/')) {
          locationUrl = locationUrl.replace('/nearby/', '/');
          log(`🔧 Исправлен URL с /nearby/: ${locationUrl}`);
        }
        
        // Убираем лишние слеши в конце
        locationUrl = locationUrl.replace(/\/+$/, '/');
        
        // Проверяем что URL правильный формат
        if (!locationUrl.match(/\/explore\/locations\/\d+\/[^\/]+\/$/)) {
          log(`⚠️ Подозрительный формат URL: ${locationUrl}`, 'warn');
        }
        
        const postParser = new PostParser(locationParser.page);
        const locationInfluencers = await postParser.parseLocationPosts(locationUrl, 10, forceRefresh);
        
        // УПРОЩЕННАЯ ЛОГИКА БЕЗ ДУБЛИРОВАНИЯ
        if (forceRefresh) {
          log(`🔄 Принудительное обновление - заменяем кэш для локации ${location.name}`);
          cache.saveCache(location.id, locationInfluencers);
          allInfluencers.push(...locationInfluencers);
        } else {
          allInfluencers.push(...locationInfluencers);
        }
        
        log(`✅ Локация ${location.name} обработана`);
        
      } catch (error) {
        log(`❌ Ошибка парсинга локации ${location.name}: ${error}`, 'error');
        continue;
      }
    }
    
    // Убираем дубликаты
    const uniqueInfluencers = allInfluencers.filter((inf, index, self) => 
      index === self.findIndex(i => i.username === inf.username)
    );
    
    log(`🎉 Парсинг завершен! Найдено уникальных инфлюенсеров: ${uniqueInfluencers.length}`);
    
    // В конце файла, где формируется ответ, замени:
    res.json({
    success: true,
    data: {
        city: cityName,
        locationsSearched: locations.length,
        influencers: uniqueInfluencers,
        totalFound: uniqueInfluencers.length,
        newlyParsed: locationsToProcess.length,
        fromCache: locationsToProcess.length === 0,
        
        // ДОБАВЬ ЭТИ НОВЫЕ ПОЛЯ:
        processedLocations: locations.map((loc: any) => ({
        name: loc.name,
        url: loc.url,
        id: loc.id
        }))
    }
    });
    
  } catch (error) {
    log(`❌ Критическая ошибка поиска по локациям: ${error}`, 'error');
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    if (locationParser) {
      try {
        await locationParser.close();
        log(`✅ Парсер закрыт`);
      } catch (closeError) {
        log(`❌ Ошибка закрытия парсера: ${closeError}`, 'error');
      }
    }
  }
});

export default router;