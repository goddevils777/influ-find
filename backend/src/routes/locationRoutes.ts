import { Router } from 'express';
import { Request, Response } from 'express';
import { LocationParser } from '../parsers/locationParser';
import { log } from '../utils/helpers';
import { ResumeParser } from '../parsers/resumeParser';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const router = Router();

// Создание базы локаций (с авторизацией)
router.post('/database/create', async (req: Request, res: Response) => {
  try {
    const { option } = req.body; // 'ukraine', 'poland', 'all'
    
    if (!['ukraine', 'poland', 'all'].includes(option)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid option. Use: ukraine, poland, or all'
      });
    }

    log(`Starting location database creation for: ${option}`);
    
    // Сначала отвечаем клиенту
    res.json({
      success: true,
      message: `Location database creation started for ${option}`,
      status: 'processing'
    });

    // Затем запускаем создание базы
    try {
      const parser = new LocationParser(true); // true = гостевой режим
      
      log(`Initializing parser for ${option}...`);
      await parser.init();
      
      log(`Parser initialized successfully, starting database creation...`);
      await parser.createLocationDatabase(option as 'ukraine' | 'poland' | 'all');
      
      log(`✅ Database creation completed successfully for: ${option}`);
      
      await parser.close();
      
    } catch (creationError) {
      log(`❌ Database creation failed for ${option}: ${creationError}`, 'error');
      
      if (creationError instanceof Error) {
        log(`Error details: ${creationError.message}`, 'error');
        log(`Error stack: ${creationError.stack}`, 'error');
      }
    }

  } catch (error) {
    log(`❌ Database creation endpoint error: ${error}`, 'error');
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to start database creation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Создание базы локаций БЕЗ АВТОРИЗАЦИИ
router.post('/database/create-guest', async (req: Request, res: Response) => {
  try {
    const { option } = req.body; // 'ukraine', 'poland', 'all'
    
    if (!['ukraine', 'poland', 'all'].includes(option)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid option. Use: ukraine, poland, or all'
      });
    }

    log(`Starting GUEST location database creation for: ${option}`);
    
    // Отвечаем сразу
    res.json({
      success: true,
      message: `Guest location database creation started for ${option}`,
      status: 'processing',
      mode: 'guest'
    });

    // Запускаем создание базы в гостевом режиме
    try {
      const parser = new LocationParser(true); // true = гостевой режим
      
      log(`Initializing guest parser for ${option}...`);
      await parser.init();
      
      log(`Guest parser initialized, starting database creation...`);
      await parser.createLocationDatabase(option as 'ukraine' | 'poland' | 'all');
      
      log(`✅ Guest database creation completed for: ${option}`);
      
      await parser.close();
      
    } catch (creationError) {
      log(`❌ Guest database creation failed for ${option}: ${creationError}`, 'error');
    }

  } catch (error) {
    log(`❌ Guest database creation endpoint error: ${error}`, 'error');
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to start guest database creation'
      });
    }
  }
});

// Проверка доступных городов в базе
router.get('/cities/available', (req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const dataPath = path.join(__dirname, '../../data/locations');
    
    if (!fs.existsSync(dataPath)) {
      return res.json({
        success: true,
        cities: [],
        message: 'No location database found. Create one first.'
      });
    }

    const files = fs.readdirSync(dataPath);
    
    const cities = files
      .filter((file: string) => file.startsWith('locations_'))
      .map((file: string) => {
        const match = file.match(/locations_(.+)_(.+)\.json/);
        if (match) {
          return {
            id: match[1],
            name: match[2],
            file: file
          };
        }
        return null;
      })
      .filter((city: any) => city !== null);

    res.json({
      success: true,
      cities: cities,
      total: cities.length
    });

  } catch (error) {
    log(`Error getting available cities: ${error}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to get available cities'
    });
  }
});

// Получить статистику базы локаций
router.get('/database/stats', (req: Request, res: Response) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const dataPath = path.join(__dirname, '../../data/locations');
    
    if (!fs.existsSync(dataPath)) {
      return res.json({
        success: true,
        stats: {
          countries: 0,
          cities: 0,
          locations: 0,
          files: []
        }
      });
    }

    const files = fs.readdirSync(dataPath);
    
    let totalLocations = 0;
    const locationFiles = files.filter((file: string) => file.startsWith('locations_'));
    
    // Подсчитываем общее количество локаций
    locationFiles.forEach((file: string) => {
      try {
        const filePath = path.join(dataPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        totalLocations += data.length;
      } catch (e) {
        // Игнорируем поврежденные файлы
      }
    });

    const countriesCount = files.filter((file: string) => file.startsWith('countries')).length;
    const citiesCount = files.filter((file: string) => file.startsWith('cities_')).length;

    res.json({
      success: true,
      stats: {
        countries: countriesCount,
        cities: citiesCount,
        locations: totalLocations,
        files: files
      }
    });

  } catch (error) {
    log(`Error getting database stats: ${error}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to get database stats'
    });
  }
});

// Получить статистику парсинга
router.get('/parsing/stats', (req: Request, res: Response) => {
  try {
    const resumeParser = new ResumeParser();
    const stats = resumeParser.getParsingStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    log(`Error getting parsing stats: ${error}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to get parsing stats'
    });
  }
});

// Продолжить парсинг Украины (с авторизацией)
router.post('/parsing/resume', async (req: Request, res: Response) => {
  try {
    const { country } = req.body; // 'ukraine'
    
    if (country !== 'ukraine') {
      return res.status(400).json({
        success: false,
        error: 'Only ukraine is supported for resume'
      });
    }

    log('Starting resume parsing for Ukraine...');
    
    // Отвечаем сразу
    res.json({
      success: true,
      message: 'Resume parsing started for Ukraine',
      status: 'processing'
    });

    // Запускаем восстановление в фоне
    const parser = new LocationParser(true); // true = гостевой режим
    const resumeParser = new ResumeParser();
    
    try {
      await parser.init();
      await resumeParser.resumeParsingUkraine(parser.page);
      await parser.close();
      
      log('✅ Resume parsing completed successfully');
    } catch (error) {
      log(`❌ Resume parsing failed: ${error}`, 'error');
    }

  } catch (error) {
    log(`Resume parsing endpoint error: ${error}`, 'error');
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to start resume parsing'
      });
    }
  }
});

// Продолжить парсинг в гостевом режиме
router.post('/parsing/resume-guest', async (req: Request, res: Response) => {
  try {
    const { country } = req.body; // 'ukraine'
    
    if (country !== 'ukraine') {
      return res.status(400).json({
        success: false,
        error: 'Only ukraine is supported for resume'
      });
    }

    log('Starting guest resume parsing for Ukraine...');
    
    res.json({
      success: true,
      message: 'Guest resume parsing started for Ukraine',
      status: 'processing',
      mode: 'guest'
    });

    // Запускаем восстановление в гостевом режиме
    const parser = new LocationParser(true); // true = гостевой режим
    const resumeParser = new ResumeParser();

    try {
    await parser.init();
    await resumeParser.resumeParsingUkraine(parser.page);
    await parser.close();
      
      log('✅ Guest resume parsing completed successfully');
    } catch (error) {
      log(`❌ Guest resume parsing failed: ${error}`, 'error');
    }

  } catch (error) {
    log(`Guest resume parsing endpoint error: ${error}`, 'error');
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to start guest resume parsing'
      });
    }
  }
});

// Получить необработанные города
router.get('/parsing/unprocessed/:country', (req: Request, res: Response) => {
  try {
    const { country } = req.params;
    
    if (country !== 'ukraine') {
      return res.status(400).json({
        success: false,
        error: 'Only ukraine is supported'
      });
    }

    const resumeParser = new ResumeParser();
    const unprocessedCities = resumeParser.getUnprocessedCities('UA');
    
    res.json({
      success: true,
      unprocessedCities: unprocessedCities.slice(0, 20), // Первые 20 для превью
      total: unprocessedCities.length
    });
    
  } catch (error) {
    log(`Error getting unprocessed cities: ${error}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to get unprocessed cities'
    });
  }
});

// Тест доступа к Instagram
router.get('/test/access', async (req: Request, res: Response) => {
  try {
    const { testInstagramAccess } = require('../utils/testConnection');
    const isAccessible = await testInstagramAccess();
    
    res.json({
      success: true,
      accessible: isAccessible,
      message: isAccessible ? 'Instagram доступен' : 'Instagram заблокирован'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test failed'
    });
  }
});

// Тест гостевого доступа
router.get('/test/guest', async (req: Request, res: Response) => {
  try {
    const { GuestParser } = require('../parsers/guestParser');
    const parser = new GuestParser();
    
    const isAccessible = await parser.testLocationAccess();
    await parser.close();
    
    res.json({
      success: true,
      guestAccessible: isAccessible,
      message: isAccessible ? 'Гостевой доступ работает' : 'Гостевой доступ заблокирован'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Guest test failed'
    });
  }
});

// Получить все страны
router.get('/countries', (req: Request, res: Response) => {
  try {
    const countriesFile = path.join(__dirname, '../../data/locations/countries.json');
    
    if (fs.existsSync(countriesFile)) {
      const countries = JSON.parse(fs.readFileSync(countriesFile, 'utf8'));
      res.json({
        success: true,
        countries: countries
      });
    } else {
      res.json({
        success: true,
        countries: []
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get countries'
    });
  }
});

// Получить города страны
router.get('/cities/:countryCode', (req: Request, res: Response) => {
  try {
    const { countryCode } = req.params;
    const citiesFile = path.join(__dirname, `../../data/locations/cities_${countryCode}.json`);
    
    if (fs.existsSync(citiesFile)) {
      const cities = JSON.parse(fs.readFileSync(citiesFile, 'utf8'));
      res.json({
        success: true,
        cities: cities
      });
    } else {
      res.json({
        success: true,
        cities: []
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cities'
    });
  }
});

// Получить локации города
router.get('/locations/:cityId', (req: Request, res: Response) => {
  try {
    const { cityId } = req.params;
    const dataPath = path.join(__dirname, '../../data/locations');
    
    if (fs.existsSync(dataPath)) {
      const files = fs.readdirSync(dataPath);
      const locationFile = files.find(file => 
        file.startsWith(`locations_${cityId}_`)
      );
      
      if (locationFile) {
        const locations = JSON.parse(fs.readFileSync(path.join(dataPath, locationFile), 'utf8'));
        res.json({
          success: true,
          locations: locations
        });
      } else {
        res.json({
          success: true,
          locations: []
        });
      }
    } else {
      res.json({
        success: true,
        locations: []
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get locations'
    });
  }
});

// Парсинг всех стран (один раз)
router.post('/parsing/countries', async (req: Request, res: Response) => {
  let locationParser: any = null;
  
  try {
    log('🌍 Начинаем парсинг всех стран с Instagram...');
    
    const { LocationParser } = require('../parsers/locationParser');
    locationParser = new LocationParser(true); // true = гостевой режим
    await locationParser.init();
    
    // Парсим все страны
    await locationParser.parseAllCountries();
    
    res.json({
      success: true,
      message: 'Все страны успешно спарсены и сохранены в базу'
    });
    
  } catch (error) {
    log(`❌ Ошибка парсинга стран: ${error}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to parse countries'
    });
  } finally {
    if (locationParser) {
      await locationParser.close();
    }
  }
});

// Парсинг городов выбранной страны
router.post('/parsing/cities/:countryCode', async (req: Request, res: Response) => {
  let locationParser: any = null;
  
  try {
    const { countryCode } = req.params;
    const { countryName } = req.body;
    
    if (!countryCode || !countryName) {
      return res.status(400).json({
        success: false,
        error: 'Country code and name are required'
      });
    }
    
    log(`🏙️ Начинаем парсинг городов для страны: ${countryName} (${countryCode})`);
    
    const { LocationParser } = require('../parsers/locationParser');
    locationParser = new LocationParser(true); // true = анонимный режим
    await locationParser.init();
    
    // Парсим города страны
    await locationParser.parseAllCitiesInCountry(countryCode, countryName);
    
    res.json({
      success: true,
      message: `Города страны ${countryName} успешно спарсены`
    });
    
  } catch (error) {
    log(`❌ Ошибка парсинга городов: ${error}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to parse cities'
    });
  } finally {
    if (locationParser) {
      await locationParser.close();
    }
  }
});

// Замени существующий прокси код на этот:
router.get('/proxy/avatar', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    log(`🖼️ Загружаем аватарку: ${url}`);
    
    const axios = require('axios');
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      },
      timeout: 10000
    });
    
    // УЛУЧШЕННЫЕ CORS ЗАГОЛОВКИ
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Embedder-Policy': 'unsafe-none'
    });
    
    log(`✅ Аватарка загружена успешно, размер: ${response.data.length} байт`);
    res.send(response.data);
    
  } catch (error) {
    log(`❌ Ошибка загрузки аватарки: ${error}`, 'error');
    res.status(404).send('Image not found');
  }
});

// Добавь также OPTIONS handler для CORS
router.options('/proxy/avatar', (req: Request, res: Response) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
  });
  res.status(200).end();
});

export default router;