import fs from 'fs';
import path from 'path';
import { LocationHierarchy } from './locationHierarchy';
import { Page } from 'puppeteer';
import { log } from '../utils/helpers';

interface City {
  id: string;
  name: string;
  country: string;
  url: string;
}

export class ResumeParser {
  private dataPath = path.join(__dirname, '../../data/locations');
  private hierarchy: LocationHierarchy;

  constructor() {
    this.hierarchy = new LocationHierarchy();
  }

  // Проверить какие города уже обработаны
    getProcessedCities(): string[] {
    try {
        if (!fs.existsSync(this.dataPath)) {
        return [];
        }

        const files = fs.readdirSync(this.dataPath);
        const processedCities = files
        .filter(file => file.startsWith('locations_'))
        .map(file => {
            try {
            // Читаем файл и проверяем количество локаций
            const filePath = path.join(this.dataPath, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Извлекаем ID города из имени файла
            const match = file.match(/locations_(.+)_(.+)\.json/);
            if (match && data.length > 0) {
                return match[1]; // Возвращаем ID города только если есть локации
            }
            
            return null;
            } catch (e) {
            return null;
            }
        })
        .filter(id => id !== null);

        log(`🔍 Найдено ${processedCities.length} успешно обработанных городов`);
        return processedCities;
        
    } catch (error) {
        log(`Ошибка получения обработанных городов: ${error}`, 'error');
        return [];
    }
    }

  // Получить все города из файла
  getAllCities(countryCode: string): City[] {
    try {
      const citiesFile = path.join(this.dataPath, `cities_${countryCode}.json`);
      
      if (!fs.existsSync(citiesFile)) {
        log(`Файл городов для ${countryCode} не найден`);
        return [];
      }

      const data = fs.readFileSync(citiesFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      log(`Ошибка чтения городов ${countryCode}: ${error}`, 'error');
      return [];
    }
  }

  // Получить города которые еще не обработаны
    getUnprocessedCities(countryCode: string): City[] {
    const allCities = this.getAllCities(countryCode);
    const successfullyProcessedCityIds = this.getProcessedCities();
    
    const unprocessedCities = allCities.filter(city => 
        !successfullyProcessedCityIds.includes(city.id)
    );

    // Дополнительно находим города с файлами но 0 локаций
    const citiesWithZeroLocations = this.getCitiesWithZeroLocations();
    
    log(`📊 Детальная статистика для ${countryCode}:`);
    log(`   Всего городов: ${allCities.length}`);
    log(`   Успешно обработано: ${successfullyProcessedCityIds.length}`);
    log(`   Городов с 0 локаций: ${citiesWithZeroLocations.length}`);
    log(`   Требует обработки: ${unprocessedCities.length}`);

    return unprocessedCities;
    }

    // Новый метод: найти города с 0 локаций
    private getCitiesWithZeroLocations(): string[] {
    try {
        if (!fs.existsSync(this.dataPath)) {
        return [];
        }

        const files = fs.readdirSync(this.dataPath);
        const citiesWithZeroLocations = files
        .filter(file => file.startsWith('locations_'))
        .map(file => {
            try {
            const filePath = path.join(this.dataPath, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            const match = file.match(/locations_(.+)_(.+)\.json/);
            if (match && data.length === 0) {
                log(`⚠️  Город ${match[2]} (${match[1]}) имеет 0 локаций - будет переобработан`);
                return match[1];
            }
            
            return null;
            } catch (e) {
            return null;
            }
        })
        .filter(id => id !== null);

        return citiesWithZeroLocations;
        
    } catch (error) {
        log(`Ошибка поиска городов с 0 локаций: ${error}`, 'error');
        return [];
    }
    }


 
// Обновленный метод восстановления парсинга
async resumeParsingUkraine(page: Page): Promise<void> {
  log('🔄 Возобновляем парсинг Украины с учетом городов с 0 локаций...');
  
  const unprocessedCities = this.getUnprocessedCities('UA');
  
  if (unprocessedCities.length === 0) {
    log('✅ Все города Украины успешно обработаны!');
    return;
  }

  log(`🏙️ Продолжаем обработку ${unprocessedCities.length} городов (включая переобработку городов с 0 локаций)...`);

  for (let i = 0; i < unprocessedCities.length; i++) {
    const city = unprocessedCities[i];
    
    try {
      log(`🏙️ Обрабатываем город ${i + 1}/${unprocessedCities.length}: ${city.name} (${city.id})`);
      
      // Проверяем что браузер работает
      if (!page || page.isClosed()) {
        log('❌ Браузер закрыт, останавливаем парсинг', 'error');
        break;
      }
      
      // Удаляем старый файл если он существует и пустой
      const sanitizedCityName = city.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const existingFile = path.join(this.dataPath, `locations_${city.id}_${sanitizedCityName}.json`);
      
      if (fs.existsSync(existingFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
          if (data.length === 0) {
            fs.unlinkSync(existingFile);
            log(`🗑️  Удален пустой файл для города ${city.name}`);
          }
        } catch (e) {
          // Игнорируем ошибки удаления
        }
      }
      
      await this.hierarchy.parseLocationsInCity(page, city.id, city.name);
      
      log(`✅ Город ${city.name} обработан успешно`);
      
      // Пауза между городами
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Логируем прогресс каждые 5 городов
      if ((i + 1) % 5 === 0) {
        log(`📊 Прогресс: обработано ${i + 1}/${unprocessedCities.length} городов`);
      }
      
    } catch (error) {
      log(`❌ Ошибка обработки города ${city.name}: ${error}`, 'error');
      
      // Если критическая ошибка - останавливаемся
      if (error instanceof Error && error.message.includes('Target closed')) {
        log('❌ Браузер был закрыт, останавливаем парсинг', 'error');
        break;
      }
      
      continue;
    }
  }
  
  log('🎉 Парсинг Украины завершен или приостановлен');
}

  // Получить статистику парсинга (обновленная версия)
getParsingStats(): any {
  try {
    const allCitiesUA = this.getAllCities('UA');
    const successfullyProcessedCities = this.getProcessedCities();
    const citiesWithZeroLocations = this.getCitiesWithZeroLocations();
    
    let totalLocations = 0;
    const files = fs.readdirSync(this.dataPath);
    
    files.filter(file => file.startsWith('locations_')).forEach(file => {
      try {
        const filePath = path.join(this.dataPath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        totalLocations += data.length;
      } catch (e) {
        // Игнорируем поврежденные файлы
      }
    });

    const needsProcessing = allCitiesUA.length - successfullyProcessedCities.length;

    return {
      ukraine: {
        totalCities: allCitiesUA.length,
        processedCities: successfullyProcessedCities.length,
        citiesWithZeroLocations: citiesWithZeroLocations.length,
        remainingCities: needsProcessing,
        totalLocations: totalLocations,
        completionPercentage: Math.round((successfullyProcessedCities.length / allCitiesUA.length) * 100)
      }
    };
  } catch (error) {
    log(`Ошибка получения статистики: ${error}`, 'error');
    return {};
  }
}
}