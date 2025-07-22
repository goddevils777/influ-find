import { log } from './helpers';

// Человекоподобные задержки и действия
export class HumanBehavior {
  
  // Рандомная задержка как у человека (читает, думает)
  static async humanDelay(min: number = 2000, max: number = 8000): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // Имитация скроллинга как у человека
  static async humanScroll(page: any): Promise<void> {
    const scrolls = Math.floor(Math.random() * 3) + 2; // 2-4 скролла
    
    for (let i = 0; i < scrolls; i++) {
      const scrollDistance = Math.floor(Math.random() * 500) + 300; // 300-800px
      await page.evaluate((distance: number) => {
        window.scrollBy(0, distance);
      }, scrollDistance);
      
      await HumanBehavior.smartDelay();
    }
  }
  
  // Имитация движения мыши
  static async humanMouseMove(page: any): Promise<void> {
    const x = Math.floor(Math.random() * 800) + 100;
    const y = Math.floor(Math.random() * 600) + 100;
    
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
    await HumanBehavior.smartDelay();
  }

  // Имитация загрузки страницы как у человека
static async humanPageLoad(page: any, url: string): Promise<void> {
  // Случайная задержка перед переходом (как будто читаем URL)
  await HumanBehavior.smartDelay();
  
  await page.goto(url, { 
    waitUntil: 'domcontentloaded', // Не ждем все ресурсы
    timeout: 15000 
  });
  
  // Имитируем что страница загружается
  await HumanBehavior.smartDelay();
  
  // Случайно двигаем мышью во время загрузки
  await this.humanMouseMove(page);
  
  // Ждем полной загрузки как человек
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    // Игнорируем таймауты - как реальный пользователь
  });
}

// Имитация клика как у человека
static async humanClick(page: any, selector: string): Promise<void> {
  try {
    const element = await page.waitForSelector(selector, { timeout: 5000 });
    if (element) {
      // Наводим мышь перед кликом
      await element.hover();
      await HumanBehavior.smartDelay();
      
      // Кликаем с рандомным offset
      const box = await element.boundingBox();
      if (box) {
        const x = box.x + box.width/2 + (Math.random() - 0.5) * 10;
        const y = box.y + box.height/2 + (Math.random() - 0.5) * 10;
        await page.mouse.click(x, y);
      }
    }
  } catch (error) {
    // Игнорируем ошибки клика
  }
}

// Имитация печатания как человек
static async humanType(page: any, selector: string, text: string): Promise<void> {
  await page.focus(selector);
  await HumanBehavior.smartDelay();
  
  // Печатаем по одному символу с задержками
  for (const char of text) {
    await page.keyboard.type(char, { 
      delay: Math.random() * 100 + 50 // 50-150ms между символами
    });
    
    // Случайные паузы как будто думаем
    if (Math.random() > 0.8) {
      await this.humanDelay(200, 800);
    }
  }
}

// Имитация бездействия (читаем контент)
static async humanIdle(): Promise<void> {
  const idleTime = Math.random() * 10000 + 5000; // 5-15 секунд
  log(`😴 Отдыхаем ${Math.round(idleTime/1000)} секунд как человек...`);
  await this.humanDelay(idleTime, idleTime + 1000);
}

// Случайные действия для имитации активности
static async randomActivity(page: any): Promise<void> {
  const actions = [
    () => this.humanMouseMove(page),
    () => this.humanScroll(page),
    () => page.keyboard.press('Tab'), // Навигация клавишами
    () => page.keyboard.press('Space'), // Прокрутка пробелом
    () => this.humanIdle()
  ];
  
  const randomAction = actions[Math.floor(Math.random() * actions.length)];
  await randomAction();
}
// Умные задержки в зависимости от времени суток
static getSmartDelay(): { min: number, max: number } {
  const hour = new Date().getHours();
  
  // Ночное время - более медленная активность
  if (hour >= 0 && hour <= 6) {
    return { min: 5000, max: 12000 }; // 5-12 сек
  }
  
  // Утро - средняя активность  
  if (hour >= 7 && hour <= 11) {
    return { min: 3000, max: 8000 }; // 3-8 сек
  }
  
  // День - быстрая активность
  if (hour >= 12 && hour <= 18) {
    return { min: 2000, max: 6000 }; // 2-6 сек
  }
  
  // Вечер - средняя активность
  return { min: 3000, max: 9000 }; // 3-9 сек
}

// Умная задержка
static async smartDelay(): Promise<void> {
  const { min, max } = this.getSmartDelay();
  await this.humanDelay(min, max);
}
// Имитация технических перерывов (проверка уведомлений, переключение вкладок)
static async technicalBreak(): Promise<void> {
  const breakType = Math.random();
  
  if (breakType > 0.8) {
    console.log('📱 Имитируем проверку уведомлений...');
    await this.humanDelay(3000, 8000);
  } else if (breakType > 0.6) {
    console.log('🔄 Имитируем переключение вкладок...');
    await this.humanDelay(2000, 5000);
  } else if (breakType > 0.4) {
    console.log('☕ Имитируем кофе-брейк...');
    await this.humanDelay(10000, 30000);
  }
  // Иначе продолжаем без перерыва
}

// Случайный технический перерыв
static async maybeDoTechnicalBreak(): Promise<void> {
  if (Math.random() > 0.9) { // 10% шанс
    await this.technicalBreak();
  }
}
}

