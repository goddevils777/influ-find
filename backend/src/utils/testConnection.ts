import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export async function testInstagramAccess(): Promise<boolean> {
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    console.log('🔍 Тестируем доступ к Instagram...');
    
    // Тестируем основную страницу
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    console.log('✅ Главная страница доступна');
    
    // Тестируем страницу локаций
    await page.goto('https://www.instagram.com/explore/locations/', { waitUntil: 'networkidle2' });
    
    const pageText = await page.evaluate(() => document.body.innerText);
    
    if (pageText.includes('429') || pageText.includes('blocked') || pageText.includes('rate limit')) {
      console.log('❌ Страница локаций заблокирована');
      await browser.close();
      return false;
    }
    
    console.log('✅ Страница локаций доступна');
    await browser.close();
    return true;
    
  } catch (error) {
    console.log(`❌ Ошибка доступа: ${error}`);
    return false;
  }
}

// Запуск теста
testInstagramAccess().then(result => {
  console.log(`Результат теста: ${result ? 'Доступ восстановлен' : 'Все еще заблокировано'}`);
});