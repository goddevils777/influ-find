export class ActivityMonitor {
  private static requestCount = 0;
  private static lastRequestTime = Date.now();
  private static suspiciousActivity = false;

  // Проверяем не слишком ли быстро делаем запросы
  static checkRequestRate(): boolean {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    this.requestCount++;
    this.lastRequestTime = now;
    
    // Если запросы слишком частые
    if (timeSinceLastRequest < 1000) { // Меньше 1 секунды
      console.log('⚠️ ПРЕДУПРЕЖДЕНИЕ: Слишком быстрые запросы!');
      return false;
    }
    
    // Если слишком много запросов за короткое время
    if (this.requestCount > 50) {
      console.log('⚠️ ПРЕДУПРЕЖДЕНИЕ: Слишком много запросов!');
      this.suspiciousActivity = true;
      return false;
    }
    
    return true;
  }

  // Принудительная пауза при подозрительной активности
  static async emergencyBreak(): Promise<void> {
    if (this.suspiciousActivity) {
      console.log('🚨 АВАРИЙНАЯ ОСТАНОВКА: Делаем длинный перерыв...');
      await new Promise(resolve => setTimeout(resolve, 60000)); // 1 минута
      this.suspiciousActivity = false;
      this.requestCount = 0;
    }
  }
  
  // Сброс статистики
  static reset(): void {
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
    this.suspiciousActivity = false;
  }
}