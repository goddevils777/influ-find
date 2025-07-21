import fs from 'fs';
import path from 'path';
import { log } from '../utils/helpers';

export class LocationCache {
  private cachePath = path.join(__dirname, '../../data/influencers');

  constructor() {
    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }
  }

  // Проверить есть ли кэш для локации
  hasCache(locationId: string): boolean {
    const cacheFile = path.join(this.cachePath, `location_${locationId}.json`);
    return fs.existsSync(cacheFile);
  }

  // Получить кэш для локации
  getCache(locationId: string): any[] {
    try {
      const cacheFile = path.join(this.cachePath, `location_${locationId}.json`);
      if (fs.existsSync(cacheFile)) {
        const data = fs.readFileSync(cacheFile, 'utf8');
        const cache = JSON.parse(data);
        
        // Проверяем что кэш не старше 7 дней
        const cacheAge = Date.now() - new Date(cache.cachedAt).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 дней в миллисекундах
        
        if (cacheAge < maxAge) {
          log(`📋 Используем кэш для локации ${locationId} (возраст: ${Math.round(cacheAge / (24 * 60 * 60 * 1000))} дней)`);
          return cache.influencers;
        } else {
          log(`🗑️ Кэш для локации ${locationId} устарел, удаляем`);
          fs.unlinkSync(cacheFile);
        }
      }
      return [];
    } catch (error) {
      log(`Ошибка чтения кэша для локации ${locationId}: ${error}`, 'error');
      return [];
    }
  }

  // Сохранить кэш для локации
  saveCache(locationId: string, influencers: any[]): void {
    try {
      const cacheFile = path.join(this.cachePath, `location_${locationId}.json`);
      const cacheData = {
        locationId,
        influencers,
        cachedAt: new Date().toISOString(),
        count: influencers.length
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      log(`💾 Сохранен кэш для локации ${locationId}: ${influencers.length} инфлюенсеров`);
    } catch (error) {
      log(`Ошибка сохранения кэша для локации ${locationId}: ${error}`, 'error');
    }
  }

  // Получить статистику кэша
  getCacheStats(): any {
    try {
      const files = fs.readdirSync(this.cachePath);
      const cacheFiles = files.filter(file => file.startsWith('location_'));
      
      let totalInfluencers = 0;
      cacheFiles.forEach(file => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(this.cachePath, file), 'utf8'));
          totalInfluencers += data.count || 0;
        } catch (e) {
          // Игнорируем поврежденные файлы
        }
      });
      
      return {
        cachedLocations: cacheFiles.length,
        totalInfluencers: totalInfluencers
      };
    } catch (error) {
      return {
        cachedLocations: 0,
        totalInfluencers: 0
      };
    }
  }
}