import fs from 'fs';
import path from 'path';

interface ParsingProgress {
  locationId: string;
  lastOffset: number;
  totalParsed: number;
  lastParsedAt: Date;
}

export class ParsingOffset {
  private offsetPath = path.join(__dirname, '../../data/parsing_progress.json');
  
  // Получить текущий offset для локации
  getOffset(locationId: string): number {
    try {
      if (!fs.existsSync(this.offsetPath)) {
        return 0;
      }
      
      const data = JSON.parse(fs.readFileSync(this.offsetPath, 'utf8'));
      const progress = data.find((p: ParsingProgress) => p.locationId === locationId);
      
      return progress ? progress.lastOffset : 0;
    } catch (error) {
      return 0;
    }
  }
  
  // Сохранить новый offset
  saveOffset(locationId: string, newOffset: number, parsedCount: number): void {
    try {
      let data: ParsingProgress[] = [];
      
      if (fs.existsSync(this.offsetPath)) {
        data = JSON.parse(fs.readFileSync(this.offsetPath, 'utf8'));
      }
      
      const existingIndex = data.findIndex(p => p.locationId === locationId);
      const progressData: ParsingProgress = {
        locationId,
        lastOffset: newOffset,
        totalParsed: parsedCount,
        lastParsedAt: new Date()
      };
      
      if (existingIndex >= 0) {
        data[existingIndex] = progressData;
      } else {
        data.push(progressData);
      }
      
      fs.writeFileSync(this.offsetPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Ошибка сохранения offset:', error);
    }
  }
  
  // Получить статистику парсинга
  getStats(locationId: string): { totalParsed: number, lastParsedAt: Date | null } {
    try {
      if (!fs.existsSync(this.offsetPath)) {
        return { totalParsed: 0, lastParsedAt: null };
      }
      
      const data = JSON.parse(fs.readFileSync(this.offsetPath, 'utf8'));
      const progress = data.find((p: ParsingProgress) => p.locationId === locationId);
      
      return progress ? 
        { totalParsed: progress.totalParsed, lastParsedAt: new Date(progress.lastParsedAt) } :
        { totalParsed: 0, lastParsedAt: null };
    } catch (error) {
      return { totalParsed: 0, lastParsedAt: null };
    }
  }
}