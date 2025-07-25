import { Router } from 'express';
import { Request, Response } from 'express';
import { searchByCity, getParserStatus, forceParseCity } from '../controllers/searchController';
import { log } from '../utils/helpers';
import { authenticateToken } from './authRoutes';
import { requireProxyAndInstagram } from '../middleware/checkConnections';

const router = Router();

// Существующие роуты
router.post('/city', searchByCity);
router.get('/status', getParserStatus);
router.post('/parse', forceParseCity);

// Поиск инфлюенсеров по выбранным локациям
router.post('/locations', authenticateToken, requireProxyAndInstagram, async (req: any, res: Response) => {
  let locationParser: any = null;
  
  try {
    const { cityName, cityId, locations, guestMode, forceRefresh, continueParsing, maxPosts = 10 } = req.body;
    
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
    
    log(`🔍 Проверяем кэш для локации ${location.name} (ID: ${locationId})`);
    
    const cacheExists = cache.hasCache(locationId);
    log(`   Файл кэша существует: ${cacheExists}`);
    
    if (cacheExists) {
        const cachedInfluencers = cache.getCache(locationId);
        log(`   Инфлюенсеров в кэше: ${cachedInfluencers.length}`);
    }
    
    if (!forceRefresh && !continueParsing && cacheExists) {
        const cachedInfluencers = cache.getCache(locationId);
        if (cachedInfluencers.length > 0) {
        log(`📋 Используем кэш для локации ${location.name}: ${cachedInfluencers.length} инфлюенсеров`);
        allInfluencers.push(...cachedInfluencers);
        continue;
        }
    }

    // Если continueParsing = true, всегда добавляем в список для парсинга
    if (continueParsing && cacheExists) {
        const cachedInfluencers = cache.getCache(locationId);
        log(`🔄 Продолжение парсинга: загружаем ${cachedInfluencers.length} из кэша + парсим дальше`);
        allInfluencers.push(...cachedInfluencers);
    }

    // Если кэша нет или принудительное обновление или продолжение - добавляем в список для парсинга
    locationsToProcess.push(location);
    }
    
    // ДОБАВЬ ПОСЛЕ СТРОКИ: log(`📊 Статистика: ${allInfluencers.length} из кэша, ${locationsToProcess.length} требуют парсинга`);

    // НОВАЯ ЛОГИКА: Если НЕ принудительное обновление - возвращаем только то что есть в кэше
    if (!forceRefresh && !continueParsing) {
    log(`📋 Обычный поиск - показываем только из кэша`);
    

    
    log(`📊 Всего инфлюенсеров загружено из кэша: ${allInfluencers.length}`);
    allInfluencers.forEach((inf, index) => {
    log(`   ${index + 1}. @${inf.username} (${inf.followersCount} подписчиков)`);
    });

    const uniqueInfluencers = allInfluencers.filter((inf, index, self) => 
        index === self.findIndex(i => i.username === inf.username)
    );

    log(`📊 Уникальных после фильтрации: ${uniqueInfluencers.length}`);
    
    return res.json({
        success: true,
        data: {
        city: cityName,
        locationsSearched: locations.length,
        influencers: uniqueInfluencers,
        totalFound: uniqueInfluencers.length,
        newlyParsed: 0,
        fromCache: true,
        message: uniqueInfluencers.length === 0 ? 
            'В кэше нет инфлюенсеров. Используйте "Спарсить новых" для поиска.' : 
            `Показано ${uniqueInfluencers.length} инфлюенсеров из кэша`,
        processedLocations: locations.map((loc: any) => ({
            name: loc.name,
            url: loc.url,
            id: loc.id
        }))
        }
    });
    }

// Если дошли сюда - значит forceRefresh=true, продолжаем парсинг
log(`🔄 ${forceRefresh ? 'Принудительное обновление' : 'Продолжение парсинга'} - запускаем парсинг ${locationsToProcess.length} локаций`);
    
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
          newlyParsed: 0,
          fromCache: true,
          processedLocations: locations.map((loc: any) => ({
            name: loc.name,
            url: loc.url,
            id: loc.id
          }))
        }
      });
    }
    
    // И замени на:
    const { PostParser } = require('../parsers/postParser');
    const { LocationParser } = require('../parsers/locationParser');

    log(`🔐 Создаем авторизованный парсер для ${locationsToProcess.length} локаций`);

    // Получаем настройки пользователя (добавь middleware requireProxyAndInstagram)
    const userId = (req as any).user?.userId;
    const userConfig = (req as any).userConfig;

    if (!userId || !userConfig) {
      throw new Error('Настройки пользователя не найдены. Убедитесь что авторизованы и подключены прокси+Instagram.');
    }

    log(`👤 Используем настройки пользователя ${userId}`);
    log(`🔗 Прокси: ${userConfig.proxyConfig.host}:${userConfig.proxyConfig.port}`);

    // Создаем парсер с настройками пользователя
    locationParser = new LocationParser(false, {
      userId: userId,
      proxyConfig: userConfig.proxyConfig
    });
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
        const locationInfluencers = await postParser.parseLocationPosts(locationUrl, maxPosts, forceRefresh);
        
        // ИСПРАВЛЕННАЯ ЛОГИКА - ВСЕГДА ДОБАВЛЯЕМ К ОБЩЕМУ МАССИВУ
        allInfluencers.push(...locationInfluencers);

        log(`✅ Локация ${location.name} обработана, найдено: ${locationInfluencers.length} инфлюенсеров`);
        
        // Сохраняем в кэш только новых инфлюенсеров
        if (locationInfluencers.length > 0) {
          cache.saveCache(location.id, locationInfluencers);
        }
        
        log(`✅ Локация ${location.name} обработана, найдено: ${locationInfluencers.length} инфлюенсеров`);
        
      } catch (error) {
        log(`❌ Ошибка парсинга локации ${location.name}: ${error}`, 'error');
        continue;
      }
    }
    
    // Убираем дубликаты по всему массиву (старые из кэша + новые из парсинга)
    const uniqueInfluencers = allInfluencers.filter((inf, index, self) => 
      index === self.findIndex(i => i.username === inf.username)
    );
    
    log(`🎉 Парсинг завершен! Всего инфлюенсеров: ${allInfluencers.length}, уникальных: ${uniqueInfluencers.length}`);
    
    // Формируем итоговый ответ
    res.json({
      success: true,
      data: {
        city: cityName,
        locationsSearched: locations.length,
        influencers: uniqueInfluencers,
        totalFound: uniqueInfluencers.length,
        newlyParsed: locationsToProcess.length,
        fromCache: locationsToProcess.length === 0,
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

// backend/src/routes/searchRoutes.ts - ДОБАВИТЬ в конец файла перед export default router;
// backend/src/routes/searchRoutes.ts - ДОБАВИТЬ в конец файла перед export default router;

// Парсинг отдельного профиля
router.post('/profile', async (req: Request, res: Response) => {
  let locationParser: any = null;
  
  try {
    const { username, guestMode } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username is required' 
      });
    }

    log(`🔍 Начинаем парсинг профиля @${username}`);
    
    // ИСПОЛЬЗУЕМ АВТОРИЗОВАННЫЙ РЕЖИМ (НЕ ГОСТЕВОЙ)
    const { LocationParser } = require('../parsers/locationParser');
    locationParser = new LocationParser(false); // false = авторизованный режим
    await locationParser.init();
    
    log(`✅ Парсер инициализирован для профиля @${username} (авторизованный режим)`);
    
    // Парсим профиль
    const profileData = await parseUserProfile(locationParser.page, username);
    
    if (!profileData) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found or private'
      });
    }
    
    log(`✅ Профиль @${username} успешно обновлен`);

    // СОХРАНЯЕМ ОБНОВЛЕННЫЕ ДАННЫЕ В КЭШ
    const { LocationCache } = require('../parsers/locationCache');
    const cache = new LocationCache();

    // Обновляем профиль во всех локациях где он есть
    const fs = require('fs');
    const path = require('path');
    const dataPath = path.join(__dirname, '../../data/locations');

    if (fs.existsSync(dataPath)) {
    const files = fs.readdirSync(dataPath);
    
    log(`🔍 Ищем профиль @${username} в кэшах локаций...`);
    log(`📊 Всего файлов кэша: ${files.length}`);

    files.forEach((file: string) => {
      if (file.startsWith('locations_') && file.endsWith('.json')) {
        const locationId = file.match(/locations_(.+)\.json/)?.[1];
        log(`📁 Проверяем файл: ${file} (locationId: ${locationId})`);
        
        if (locationId) {
          const cachedInfluencers = cache.getCache(locationId) || [];
          const hasUser = cachedInfluencers.some((inf: any) => inf.username === username);
          log(`   Инфлюенсеров: ${cachedInfluencers.length}, есть @${username}: ${hasUser ? 'ДА' : 'НЕТ'}`);
            
            // Находим и обновляем профиль
            // Находим и обновляем профиль
            let profileFound = false;
            const updatedInfluencers = cachedInfluencers.map((inf: any) => {
            if (inf.username === username) {
                profileFound = true;
                log(`🔍 Найден профиль @${username} в локации ${locationId}, обновляем данные...`);
                log(`   Старая аватарка: ${inf.avatarUrl || 'НЕТ'}`);
                log(`   Новая аватарка: ${profileData.avatarUrl || 'НЕТ'}`);

                log(`🔍 ОТЛАДКА ОБНОВЛЕНИЯ:`);
                log(`   profileData содержит: ${Object.keys(profileData).join(', ')}`);
                log(`   Аватарка передается: ${profileData.avatarUrl ? 'ДА' : 'НЕТ'}`);
                
                const updated = {
                ...inf,
                followersCount: profileData.followersCount || inf.followersCount,
                fullName: profileData.fullName || inf.fullName,
                bio: profileData.bio || inf.bio,
                avatarUrl: profileData.avatarUrl || inf.avatarUrl,
                lastUpdated: profileData.lastUpdated
                };
                
                log(`   Результат: аватарка ${updated.avatarUrl || 'НЕТ'}`);
                return updated;
            }
            return inf;
            });

            if (profileFound) {
            log(`✅ Профиль @${username} найден и обновлен в локации ${locationId}`);
            } else {
            log(`❌ Профиль @${username} НЕ найден в локации ${locationId}`);
            }
            
            // Сохраняем если были изменения
            // Сохраняем если были изменения
            if (updatedInfluencers.some((inf: any) => inf.username === username)) {
              log(`💾 СОХРАНЯЕМ ОБНОВЛЕННЫЙ КЭШ для локации ${locationId}`);
              log(`   Количество инфлюенсеров: ${updatedInfluencers.length}`);
              
              // Проверим что аватарка действительно есть в обновленных данных
              const updatedUser = updatedInfluencers.find((inf: any) => inf.username === username);
              if (updatedUser) {
                log(`   Аватарка у @${username} в обновленном массиве: ${updatedUser.avatarUrl ? 'ЕСТЬ' : 'НЕТ'}`);
              }
              
              cache.saveCache(locationId, updatedInfluencers);
              log(`💾 Обновлен кэш для локации ${locationId} с новыми данными @${username}`);
            } else {
              log(`❌ НЕ СОХРАНЯЕМ - профиль @${username} не найден в массиве для сохранения`);
            }
        }
        }
    });
    }

    log(`✅ Данные @${username} обновлены во всех кэшах локаций`);
    
    res.json({
      success: true,
      data: profileData
    });
    
  } catch (error) {
    log(`❌ Ошибка парсинга профиля @${req.body.username}: ${error}`, 'error');
    res.status(500).json({ 
      success: false, 
      error: 'Profile parsing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    if (locationParser) {
      try {
        await locationParser.close();
        log(`✅ Парсер профиля закрыт`);
      } catch (closeError) {
        log(`❌ Ошибка закрытия парсера профиля: ${closeError}`, 'error');
      }
    }
  }
});

async function parseUserProfile(page: any, username: string) {
  try {
    const profileUrl = `https://www.instagram.com/${username}/`;
    log(`🔗 Переходим к профилю: ${profileUrl}`);
    
    await page.goto(profileUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 15000 
    });
    
    // Проверяем что профиль существует
    const pageTitle = await page.title();
    if (pageTitle.includes('Page Not Found') || pageTitle.includes('Sorry')) {
      log(`❌ Профиль @${username} не найден`);
      return null;
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Извлекаем данные профиля
    const profileData = await page.evaluate(() => {
      // Подписчики - ищем правильный элемент
      let followersCount = 0;
      
      const headerLinks = document.querySelectorAll('header a');
      for (const link of headerLinks) {
        const text = link.textContent || '';
        if (text.includes('followers')) {
          const numberText = text.match(/([\d,\.]+[KMBkmb]?)/);
          if (numberText) {
            let num = numberText[1].replace(/,/g, '').toLowerCase();
            if (num.includes('k')) {
              followersCount = Math.round(parseFloat(num) * 1000);
            } else if (num.includes('m')) {
              followersCount = Math.round(parseFloat(num) * 1000000);
            } else {
              followersCount = parseInt(num.replace(/[^\d]/g, ''));
            }
          }
          break;
        }
      }
      
      // Полное имя
      let fullName = '';
      const headerH2 = document.querySelector('header h2');
      if (headerH2?.textContent) {
        fullName = headerH2.textContent.trim();
      }
      
      // Био - ищем в правильном контейнере
// Био - точно как в основном парсере
      let bio = '';
      const bioSelectors = [
        'div[class*="_a6hd"] span',
        'header section div span',
        '[data-testid="user-description"] span',
        'span[class*="_ap3a"]',
        'span[class*="_aaco"]',
        'article header div div span',
        'header div span'
      ];

      for (const selector of bioSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim() || '';
          if (text.length > bio.length && 
              text.length > 10 && 
              text.length < 1000 && 
              !text.includes('подписчик') && 
              !text.includes('публикац') &&
              !text.match(/^\d+$/) &&
              !text.match(/^@\w+$/)) {
            bio = text;
          }
        }
      }
      
    // Аватарка - улучшенная логика с логированием
    let avatarUrl = '';
    const avatarSelectors = [
      'img[alt*="profile picture"]',
      'img[data-testid="user-avatar"]', 
      'header section img[src*="https"]',
      'img[alt*="\'s profile picture"]',
      'article img[src*="scontent"]',
      'div[role="img"] img'
    ];

    console.log('🔍 Ищем аватарку...');
    for (const selector of avatarSelectors) {
      const avatarEl = document.querySelector(selector);
      if (avatarEl) {
        const src = avatarEl.getAttribute('src');
        console.log(`Найден элемент: ${selector}, src: ${src?.substring(0, 80)}...`);
        if (src && (src.includes('scontent') || src.includes('cdninstagram') || src.includes('instagram'))) {
          avatarUrl = src;
          console.log('✅ Аватарка найдена: ' + src.substring(0, 100));
          break;
        }
      }
    }
    console.log('📷 Финальный URL аватарки: ' + (avatarUrl || 'НЕТ'));
          
   return {
  followersCount,
  fullName: fullName || 'Unknown User',
  bio: bio || 'Описание не указано',
  avatarUrl,
  lastUpdated: new Date().toISOString()
};
    });
    
    log(`📊 Обновлены данные @${username}: ${profileData.followersCount} подписчиков`);

    // Добавь после неё:
    log(`🔍 ОТЛАДКА АВАТАРКИ @${username}:`);
    log(`   Найдена аватарка: ${profileData.avatarUrl ? 'ДА' : 'НЕТ'}`);
    if (profileData.avatarUrl) {
      log(`   URL: ${profileData.avatarUrl.substring(0, 100)}...`);
    }
    log(`   Размер данных профиля: ${JSON.stringify(profileData).length} символов`);
    
    return profileData;
    
  } catch (error) {
    log(`❌ Ошибка парсинга @${username}: ${error}`, 'error');
    return null;
  }
}

export default router;