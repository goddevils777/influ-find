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
    
    log(`🔍 Проверяем кэш для локации ${location.name} (ID: ${locationId})`);
    
    const cacheExists = cache.hasCache(locationId);
    log(`   Файл кэша существует: ${cacheExists}`);
    
    if (cacheExists) {
        const cachedInfluencers = cache.getCache(locationId);
        log(`   Инфлюенсеров в кэше: ${cachedInfluencers.length}`);
    }
    
    if (!forceRefresh && cacheExists) {
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

// Функция парсинга профиля
async function parseUserProfile(page: any, username: string) {
  try {
    const profileUrl = `https://www.instagram.com/${username}/`;
    log(`🔗 Переходим к профилю: ${profileUrl}`);
    
    await page.goto(profileUrl, { 
      waitUntil: 'networkidle2', 
      timeout: 15000 
    });
    
    // Проверяем что профиль существует и мы авторизованы
    const pageTitle = await page.title();
    if (pageTitle.includes('Page Not Found') || pageTitle.includes('Sorry')) {
      log(`❌ Профиль @${username} не найден`);
      return null;
    }
    
    // ПРОВЕРЯЕМ НА ФОРМУ ЛОГИНА
    const hasLoginForm = await page.evaluate(() => {
      return !!document.querySelector('input[name="username"]');
    });
    
    if (hasLoginForm) {
      log(`❌ Требуется авторизация для профиля @${username} - форма логина обнаружена`);
      return null;
    }
    
    // Ждем загрузки контента - используем правильный метод
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Извлекаем данные профиля
    const profileData = await page.evaluate(() => {
      // Подписчики - улучшенный поиск
      let followersCount = 0;
      let followersText = '';
      
      // Ищем текст с подписчиками
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const text = el.textContent || '';
        if (text.match(/\d+[KMB]?\s*(followers|подписчик)/i) && text.length < 100) {
          followersText = text;
          break;
        }
      }
      
      if (followersText) {
        const match = followersText.match(/([\d,\.]+[KMBkmb]?)/);
        if (match) {
          let num = match[1].replace(/,/g, '').toLowerCase();
          if (num.includes('k')) {
            followersCount = parseFloat(num) * 1000;
          } else if (num.includes('m')) {
            followersCount = parseFloat(num) * 1000000;
          } else if (num.includes('b')) {
            followersCount = parseFloat(num) * 1000000000;
          } else {
            followersCount = parseInt(num);
          }
        }
      }
      
      // Полное имя - улучшенный поиск
      let fullName = '';
      const nameSelectors = [
        'h1',
        'h2',
        '[data-testid="user-name"]',
        'header h1',
        'header h2',
        'span[dir="auto"]'
      ];
      
      for (const selector of nameSelectors) {
        const nameEl = document.querySelector(selector);
        if (nameEl && nameEl.textContent && nameEl.textContent.trim().length > 0) {
          const text = nameEl.textContent.trim();
          // Проверяем что это не username
          if (!text.startsWith('@') && text.length < 50) {
            fullName = text;
            break;
          }
        }
      }
      
      // Био - расширенный поиск
      let bio = '';
      const bioSelectors = [
        'div[class*="_a6hd"] span',
        'header section div span',
        '[data-testid="user-description"] span',
        'span[class*="_ap3a"]',
        'span[class*="_aaco"]',
        'article header div div span',
        'header div span',
        'div[dir="auto"] span'
      ];
      
      for (const selector of bioSelectors) {
        const bioElements = document.querySelectorAll(selector);
        for (const bioEl of bioElements) {
          if (bioEl && bioEl.textContent) {
            const text = bioEl.textContent.trim();
            // Проверяем что это био (не слишком короткое и не содержит служебную информацию)
            if (text.length > 5 && text.length < 500 && 
                !text.includes('followers') && !text.includes('following') && 
                !text.includes('posts') && !text.match(/^\d+$/)) {
              bio = text;
              break;
            }
          }
        }
        if (bio) break;
      }
      
      // Аватарка - улучшенный поиск
      let avatarUrl = '';
      const avatarSelectors = [
        'img[alt*="profile picture"]',
        'img[data-testid="user-avatar"]', 
        'header img',
        'img[alt*="\'s profile picture"]',
        'canvas + img',
        'img[src*="profile"]'
      ];
      
      for (const selector of avatarSelectors) {
        const avatarEl = document.querySelector(selector);
        if (avatarEl) {
          const src = avatarEl.getAttribute('src');
          if (src && src.includes('http')) {
            avatarUrl = src;
            break;
          }
        }
      }
      
      // Количество постов
      let postsCount = 0;
      const allText = document.body.textContent || '';
      const postsMatch = allText.match(/(\d+[,\d]*)\s*posts/i);
      if (postsMatch) {
        postsCount = parseInt(postsMatch[1].replace(/,/g, ''));
      }
      
      return {
        followersCount,
        fullName,
        bio,
        avatarUrl,
        postsCount,
        lastUpdated: new Date().toISOString()
      };
    });
    
    log(`📊 Данные профиля @${username}:`);
    log(`   Подписчики: ${profileData.followersCount}`);
    log(`   Имя: ${profileData.fullName}`);
    log(`   Посты: ${profileData.postsCount}`);
    log(`   Аватарка: ${profileData.avatarUrl ? 'Есть' : 'Нет'}`);
    log(`   Био: ${profileData.bio ? profileData.bio.substring(0, 50) + '...' : 'Нет'}`);
    
    return profileData;
    
  } catch (error) {
    log(`❌ Ошибка парсинга профиля @${username}: ${error}`, 'error');
    return null;
  }
}

export default router;