// backend/src/utils/parsingCheckpoint.ts - НОВЫЙ ФАЙЛ
import fs from 'fs';
import path from 'path';
import { log } from './helpers';

export interface CheckpointData {
  locationId: string;
  locationUrl: string;
  currentPostIndex: number;
  totalPosts: number;
  foundInfluencers: any[];
  lastProcessedPost: string;
  timestamp: string;
  sessionId: string;
}

export class ParsingCheckpoint {
  private checkpointPath = path.join(__dirname, '../../data/checkpoints');

  constructor() {
    if (!fs.existsSync(this.checkpointPath)) {
      fs.mkdirSync(this.checkpointPath, { recursive: true });
    }
  }

  // Создать checkpoint с текущим прогрессом
  saveCheckpoint(data: CheckpointData): void {
    try {
      const checkpointFile = path.join(this.checkpointPath, `checkpoint_${data.locationId}.json`);
      const checkpointData = {
        ...data,
        timestamp: new Date().toISOString(),
        sessionId: this.generateSessionId()
      };
      
      fs.writeFileSync(checkpointFile, JSON.stringify(checkpointData, null, 2));
      log(`💾 Checkpoint сохранен: ${data.currentPostIndex}/${data.totalPosts} постов, найдено ${data.foundInfluencers.length} инфлюенсеров`);
    } catch (error) {
      log(`❌ Ошибка сохранения checkpoint: ${error}`, 'error');
    }
  }

  // Загрузить последний checkpoint
  loadCheckpoint(locationId: string): CheckpointData | null {
    try {
      const checkpointFile = path.join(this.checkpointPath, `checkpoint_${locationId}.json`);
      
      if (fs.existsSync(checkpointFile)) {
        const data = fs.readFileSync(checkpointFile, 'utf8');
        const checkpoint = JSON.parse(data);
        
        // Проверяем что checkpoint не старше 1 часа
        const checkpointAge = Date.now() - new Date(checkpoint.timestamp).getTime();
        const maxAge = 60 * 60 * 1000; // 1 час
        
        if (checkpointAge < maxAge) {
          log(`🔄 Найден checkpoint: ${checkpoint.currentPostIndex}/${checkpoint.totalPosts} постов, ${checkpoint.foundInfluencers.length} инфлюенсеров`);
          return checkpoint;
        } else {
          log(`🗑️ Checkpoint устарел (${Math.round(checkpointAge / (60 * 1000))} мин), удаляем`);
          fs.unlinkSync(checkpointFile);
        }
      }
      
      return null;
    } catch (error) {
      log(`❌ Ошибка загрузки checkpoint: ${error}`, 'error');
      return null;
    }
  }

  // Удалить checkpoint после успешного завершения
  clearCheckpoint(locationId: string): void {
    try {
      const checkpointFile = path.join(this.checkpointPath, `checkpoint_${locationId}.json`);
      if (fs.existsSync(checkpointFile)) {
        fs.unlinkSync(checkpointFile);
        log(`🗑️ Checkpoint очищен для локации ${locationId}`);
      }
    } catch (error) {
      log(`❌ Ошибка удаления checkpoint: ${error}`, 'error');
    }
  }

  // Автосохранение каждые N постов
  autoSave(data: CheckpointData, interval: number = 3): boolean {
    if (data.currentPostIndex % interval === 0) {
      this.saveCheckpoint(data);
      return true;
    }
    return false;
  }

  // Экстренное сохранение при закрытии
  emergencySave(data: CheckpointData): void {
    try {
      const emergencyFile = path.join(this.checkpointPath, `emergency_${data.locationId}_${Date.now()}.json`);
      fs.writeFileSync(emergencyFile, JSON.stringify(data, null, 2));
      log(`🚨 ЭКСТРЕННОЕ СОХРАНЕНИЕ: ${data.foundInfluencers.length} инфлюенсеров на посту ${data.currentPostIndex}`);
    } catch (error) {
      log(`❌ Ошибка экстренного сохранения: ${error}`, 'error');
    }
  }

  // Получить все доступные checkpoint'ы
  getAllCheckpoints(): CheckpointData[] {
    try {
      const files = fs.readdirSync(this.checkpointPath);
      const checkpoints: CheckpointData[] = [];
      
      files
        .filter(file => file.startsWith('checkpoint_') && file.endsWith('.json'))
        .forEach(file => {
          try {
            const data = fs.readFileSync(path.join(this.checkpointPath, file), 'utf8');
            const checkpoint = JSON.parse(data);
            checkpoints.push(checkpoint);
          } catch (e) {
            // Игнорируем поврежденные файлы
          }
        });
      
      return checkpoints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      return [];
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}