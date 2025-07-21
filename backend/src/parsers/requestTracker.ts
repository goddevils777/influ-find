import { PARSER_CONFIG } from '../config/parser';
import { log } from '../utils/helpers';

export class RequestTracker {
  private requestCount: number = 0;
  private totalRequests: number = 0;
  private cooldownCount: number = 0;

  incrementRequest(): void {
    this.requestCount++;
    this.totalRequests++;
  }

  shouldTakeCooldown(): boolean {
    return this.requestCount >= PARSER_CONFIG.limits.requestsBeforeCooldown;
  }

  async takeCooldownIfNeeded(): Promise<void> {
    if (this.shouldTakeCooldown()) {
      this.cooldownCount++;
      const pauseMinutes = PARSER_CONFIG.delays.cooldownPause / 60000;
      
      log(`⏸️  ПАУЗА #${this.cooldownCount}: Сделано ${this.requestCount} запросов, пауза ${pauseMinutes} минут для безопасности...`);
      log(`📊 Всего запросов с начала парсинга: ${this.totalRequests}`);
      
      // Показываем обратный отсчет
      for (let i = pauseMinutes; i > 0; i--) {
        log(`⏰ Осталось ${i} минут до продолжения...`);
        await new Promise(resolve => setTimeout(resolve, 60000)); // 1 минута
      }
      
      this.requestCount = 0; // Сбрасываем счетчик
      log(`▶️  Пауза завершена! Продолжаем парсинг...`);
    }
  }

  getStats(): { 
    currentRequests: number; 
    totalRequests: number; 
    cooldownCount: number;
    nextCooldownIn: number;
  } {
    return {
      currentRequests: this.requestCount,
      totalRequests: this.totalRequests,
      cooldownCount: this.cooldownCount,
      nextCooldownIn: PARSER_CONFIG.limits.requestsBeforeCooldown - this.requestCount
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.totalRequests = 0;
    this.cooldownCount = 0;
  }
}