import { Router } from 'express';
import { Request, Response } from 'express';
import { LocationParser } from '../parsers/locationParser';
import { log } from '../utils/helpers';
import { ResumeParser } from '../parsers/resumeParser';

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
      const parser = new LocationParser(false); // false = с авторизацией
      
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
    const parser = new LocationParser(false); // false = с авторизацией
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

export default router;