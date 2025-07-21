import { PARSER_CONFIG } from '../config/parser';
import { delay, randomDelay, log, formatFollowersCount, generateUserId } from '../utils/helpers';
import { Influencer } from '../models/influencer';
import { LocationCache } from './locationCache';

export class PostParser {
  private page: any;
  private cache: LocationCache;

  constructor(page: any) {
    this.page = page;
    this.cache = new LocationCache();
  }

async parseLocationPosts(locationUrl: string, maxPosts: number = 10, forceRefresh: boolean = false): Promise<Partial<Influencer>[]> {
    try {
      // Извлекаем ID локации из URL
      const locationId = this.extractLocationId(locationUrl);
      if (!locationId) {
        log(`❌ Не удалось извлечь ID локации из URL: ${locationUrl}`, 'error');
        return [];
      }

      // Проверяем кэш
    // Проверяем кэш (только если не принудительное обновление)
    const forceRefresh = arguments.length > 2 ? arguments[2] : false; // Получаем третий параметр
    if (!forceRefresh && this.cache.hasCache(locationId)) {
    const cachedInfluencers = this.cache.getCache(locationId);
    if (cachedInfluencers.length > 0) {
        log(`✅ Используем кэшированных инфлюенсеров для локации ${locationId}: ${cachedInfluencers.length}`);
        return cachedInfluencers;
    }
    }

    if (forceRefresh) {
    log(`🔄 Принудительное обновление - игнорируем кэш для локации ${locationId}`);
    }

      log(`🔍 Парсинг постов по URL: ${locationUrl}`);
      
      await this.page.goto(locationUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await delay(PARSER_CONFIG.delays.pageLoad);
            
        // Ищем посты на странице локации
        const posts = await this.page.evaluate((maxPosts: number) => {
        // Попробуем разные селекторы для постов
        const selectors = [
            'article a[href*="/p/"]',
            'a[href*="/p/"]',
            '[role="link"][href*="/p/"]',
            'div a[href*="/p/"]'
        ];
        
        let foundLinks: string[] = [];
        
        for (const selector of selectors) {
            const links = Array.from(document.querySelectorAll(selector));
            console.log(`Селектор "${selector}" нашел: ${links.length} ссылок`);
            
            if (links.length > 0) {
            foundLinks = links
                .slice(0, maxPosts)
                .map((link: any) => link.href)
                .filter((href: string) => href && href.includes('/p/'));
            
            console.log(`Отфильтровано постов: ${foundLinks.length}`);
            break;
            }
        }
        
        return foundLinks;
        }, maxPosts);

        log(`📸 Найдено ${posts.length} постов в локации`);

        // Если постов нет - логируем содержимое страницы для отладки
        if (posts.length === 0) {
        log(`❌ Посты не найдены, проверяем содержимое страницы...`);
        
        const pageInfo = await this.page.evaluate(() => {
            return {
            title: document.title,
            url: window.location.href,
            hasMain: !!document.querySelector('main'),
            hasArticles: document.querySelectorAll('article').length,
            allLinksCount: document.querySelectorAll('a').length,
            postLinksCount: document.querySelectorAll('a[href*="/p/"]').length,
            bodyText: document.body.innerText.substring(0, 200)
            };
        });
        
        log(`📄 Заголовок: ${pageInfo.title}`);
        log(`📄 URL: ${pageInfo.url}`);
        log(`📄 Articles: ${pageInfo.hasArticles}`);
        log(`📄 Всего ссылок: ${pageInfo.allLinksCount}`);
        log(`📄 Ссылок на посты: ${pageInfo.postLinksCount}`);
        log(`📄 Текст: ${pageInfo.bodyText}`);
        }
      const influencers: Partial<Influencer>[] = [];
      
      // Анализируем каждый пост
      for (let i = 0; i < Math.min(posts.length, maxPosts); i++) {
        try {
          const postUrl = posts[i];
          log(`📄 Парсим пост ${i + 1}/${posts.length}: ${postUrl}`);
          
          await this.page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          await delay(2000);
          
          // Извлекаем username автора поста
          const username = await this.page.evaluate(() => {
            const usernameLink = document.querySelector('header a[role="link"]');
            if (usernameLink) {
              const href = usernameLink.getAttribute('href');
              return href ? href.replace(/\//g, '') : null;
            }
            return null;
          });
          
          if (username && !influencers.find(inf => inf.username === username)) {
            log(`👤 Найден пользователь: @${username}, переходим на страницу reels...`);
            
            // Переходим на страницу reels пользователя
            const reelsUrl = `https://www.instagram.com/${username}/reels/`;
            await this.page.goto(reelsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
            await delay(3000);
            
            // Извлекаем данные профиля и статистику reels
         // Извлекаем данные профиля и статистику reels
const profileData = await this.page.evaluate(() => {
  console.log('=== ОТЛАДКА ПРОФИЛЯ ===');
  
  // Получаем количество подписчиков - пробуем разные селекторы
  let followersText = '0';
  const followerSelectors = [
    'a[href*="/followers/"] span[title]',
    'a[href*="/followers/"] span',
    '[data-testid="followers"] span',
    'header section ul li:nth-child(2) span',
    'header section ul li a span'
  ];
  
  for (const selector of followerSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      followersText = element.getAttribute('title') || element.textContent || '0';
      console.log(`Подписчики найдены селектором "${selector}": ${followersText}`);
      break;
    }
  }
  // Получаем био - ищем в span с классами _ap3a как есть, без очистки
let bio = '';
console.log('=== ПОИСК БИО В НОВОЙ СТРУКТУРЕ ===');

// Сначала ищем span с классами _ap3a, _aaco и т.д.
const bioSpans = document.querySelectorAll('span[class*="_ap3a"], span[class*="_aaco"]');
console.log(`Найдено потенциальных span для био: ${bioSpans.length}`);

for (const span of bioSpans) {
  const text = span.textContent?.trim() || '';
  console.log(`Проверяем span с био: "${text.substring(0, 100)}..."`);
  
  // Проверяем что это не просто имя пользователя и содержит полезную информацию
  if (text.length > 10 && 
      text.length < 500 && 
      !text.includes('подписчик') && 
      !text.includes('публикац') &&
      !text.match(/^@\w+$/) && // не просто @username
      (text.includes(':') || text.includes('Ukraine') || text.includes('@') || text.includes('📮') || text.length > 20)) {
    
    bio = text; // ОСТАВЛЯЕМ КАК ЕСТЬ
    console.log(`✅ Био найдено: "${bio.substring(0, 100)}..."`);
    break;
  }
}

// Если не нашли, пробуем альтернативный поиск
if (!bio) {
  console.log('Пробуем альтернативный поиск био...');
  
  // Ищем div с role="button" который может содержать био
  const buttonDivs = document.querySelectorAll('div[role="button"]');
  for (const div of buttonDivs) {
    const text = div.textContent?.trim() || '';
    if (text.length > 20 && 
        text.length < 500 && 
        (text.includes('Ukraine') || text.includes('@') || text.includes(':'))) {
      
      bio = text; // ОСТАВЛЯЕМ КАК ЕСТЬ
      console.log(`✅ Био найдено в альтернативном поиске: "${bio.substring(0, 100)}..."`);
      break;
    }
  }
}

console.log(`=== ИТОГ БИО: "${bio.substring(0, 100)}..." ===`);
  
  // Получаем полное имя
  let fullName = '';
  const nameSelectors = [
    'header section div h2',
    'header section h2',
    'header h2',
    'h1'
  ];
  
  for (const selector of nameSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      fullName = element.textContent || '';
      console.log(`Имя найдено селектором "${selector}": ${fullName}`);
      break;
    }
  }
  
  // Получаем статистику reels - пробуем найти видео
  const reelsSelectors = [
    'article a[href*="/reel/"]',
    'a[href*="/reel/"]',
    'div[role="button"] a[href*="/reel/"]'
  ];
  
  let reelsVideos: any[] = [];
  for (const selector of reelsSelectors) {
    reelsVideos = Array.from(document.querySelectorAll(selector));
    if (reelsVideos.length > 0) {
      console.log(`Reels найдены селектором "${selector}": ${reelsVideos.length} видео`);
      break;
    }
  }
  const reelsStats = reelsVideos.slice(0, 4).map((reel: any, index: number) => {
  console.log(`Анализируем reel ${index + 1}:`, reel.href);
  
  // Ищем родительский контейнер с видео
  const videoContainer = reel.closest('div') || reel.parentElement;
  
  let views = '0';
  if (videoContainer) {
    // СНАЧАЛА ИЩЕМ ИКОНКУ ПРОСМОТРОВ
    const viewIcon = videoContainer.querySelector('svg[aria-label*="просмотр"], svg[aria-label*="view"], svg[aria-label*="Значок числа просмотров"]');
    
    if (viewIcon) {
      console.log('✅ Найдена иконка просмотров');
      
      // Ищем span рядом с иконкой просмотров
      const iconParent = viewIcon.closest('div');
      if (iconParent) {
        const nearbySpans = iconParent.querySelectorAll('span');
        for (const span of nearbySpans) {
          const text = span.textContent || '';
          const cleanText = text.replace(/\s/g, '');
          
          if (text.match(/[\d\s]+/) && !text.includes('подписчик')) {
            const num = parseInt(cleanText.replace(/[^\d]/g, ''));
            if (num > 10) {
              views = cleanText;
              console.log(`✅ ПРОСМОТРЫ найдены рядом с иконкой для reel ${index + 1}: ${views}`);
              break;
            }
          }
        }
      }
    }
    
    // ЕСЛИ НЕ НАШЛИ РЯДОМ С ИКОНКОЙ, ищем в html-span НО ТОЛЬКО БОЛЬШИЕ ЧИСЛА
    if (views === '0') {
      const htmlSpans = videoContainer.querySelectorAll('span.html-span');
      console.log(`Ищем в html-span элементах: ${htmlSpans.length}`);
      
      for (const span of htmlSpans) {
        const text = span.textContent || '';
        const cleanText = text.replace(/\s/g, '');
        
        if (text.match(/[\d\s]+/)) {
          const num = parseInt(cleanText.replace(/[^\d]/g, ''));
          
          // ПРОСМОТРЫ ОБЫЧНО БОЛЬШЕ ЛАЙКОВ - берем только числа больше 100
          if (num > 100) {
            views = cleanText;
            console.log(`✅ ПРОСМОТРЫ найдены в html-span для reel ${index + 1}: ${views} (${num} > 100)`);
            break;
          } else {
            console.log(`⏭️ Пропускаем малое число в html-span: ${num} (вероятно лайки)`);
          }
        }
      }
    }
    
    // ПОСЛЕДНИЙ РЕЗЕРВ - ищем самое большое число в контейнере
    if (views === '0') {
      console.log('Ищем самое большое число как просмотры...');
      const allSpans = videoContainer.querySelectorAll('span');
      let maxNum = 0;
      let maxText = '0';
      
      for (const span of allSpans) {
        const text = span.textContent || '';
        const cleanText = text.replace(/\s/g, '');
        
        if (text.match(/[\d\s]+/) && !text.includes('подписчик')) {
          const num = parseInt(cleanText.replace(/[^\d]/g, ''));
          if (num > maxNum && num > 50) {
            maxNum = num;
            maxText = cleanText;
          }
        }
      }
      
      if (maxNum > 0) {
        views = maxText;
        console.log(`✅ ПРОСМОТРЫ найдены как максимальное число для reel ${index + 1}: ${views}`);
      }
    }
  }
  
  console.log(`🎯 ИТОГО для reel ${index + 1}: views = "${views}"`);
  
  return {
    views: views,
    likes: '0'
  };
});
  
  console.log('=== ИТОГО ДАННЫХ ===');
  console.log('Подписчики:', followersText);
  console.log('Био:', bio.substring(0, 100));
  console.log('Имя:', fullName);
  console.log('Reels найдено:', reelsStats.length);
  
  return {
    followersText,
    bio,
    fullName,
    reelsStats
  };
});

log(`👤 Данные профиля @${username}:`);
log(`   Подписчики: ${profileData.followersText}`);
log(`   Био: ${profileData.bio.substring(0, 50)}${profileData.bio.length > 50 ? '...' : ''}`);
log(`   Имя: ${profileData.fullName}`);
log(`   Reels: ${profileData.reelsStats.length}`);
            
            const followersCount = this.parseFollowersCount(profileData.followersText);
            
           if (followersCount >= PARSER_CONFIG.limits.minFollowers) {
            const influencer = {
                username: username,
                fullName: profileData.fullName || username,
                followersCount: followersCount,
                bio: profileData.bio,
                cityId: 'parsed_city',
                id: this.generateUserId(),
                categories: ['Local'],
                reelsViews: profileData.reelsStats.map((reel: any) => reel.views),
                reelsCount: profileData.reelsStats.length,
                createdAt: new Date()
            };
            
            influencers.push(influencer);
              
              const viewsList = profileData.reelsStats.map((reel: any) => reel.views).join(', ');
                log(`✅ Добавлен инфлюенсер: @${username} (${followersCount.toLocaleString()} подписчиков, просмотры reels: ${viewsList})`);
            } else {
              log(`⏭️ Пропущен @${username} (${followersCount} подписчиков - меньше минимума)`);
            }
          }
          
        } catch (error) {
          log(`❌ Ошибка парсинга поста ${i + 1}: ${error}`, 'error');
          continue;
        }
      }
      
      // После завершения парсинга сохраняем в кэш
      if (influencers.length > 0) {
        this.cache.saveCache(locationId, influencers);
      }
      
      log(`✅ Завершен парсинг локации. Найдено ${influencers.length} подходящих инфлюенсеров`);
      return influencers;
      
    } catch (error) {
      log(`❌ Ошибка парсинга локации: ${error}`, 'error');
      return [];
    }
  }

  private extractLocationId(locationUrl: string): string | null {
    const match = locationUrl.match(/\/locations\/(\d+)\//);
    return match ? match[1] : null;
  }

  private calculateAverageViews(reelsStats: any[]): number {
    if (reelsStats.length === 0) return 0;
    
    const totalViews = reelsStats.reduce((sum, reel) => {
      const views = this.parseViewsCount(reel.views);
      return sum + views;
    }, 0);
    
    return Math.round(totalViews / reelsStats.length);
  }

  private parseViewsCount(viewsText: string): number {
    const text = viewsText.toLowerCase();
    const numMatch = text.match(/[\d.,]+/);
    if (!numMatch) return 0;
    
    const num = parseFloat(numMatch[0].replace(',', '.'));
    if (text.includes('k')) return Math.round(num * 1000);
    if (text.includes('m')) return Math.round(num * 1000000);
    return Math.round(num);
  }

private parseFollowersCount(followersText: string): number {
  if (!followersText || followersText === '0') return 0;
  
  // Убираем лишние пробелы и приводим к нижнему регистру
  const text = followersText.toLowerCase().trim();
  
  // Обрабатываем числа с K, M
  if (text.includes('k')) {
    const numMatch = text.match(/([\d.,]+)\s*k/);
    if (numMatch) {
      const num = parseFloat(numMatch[1].replace(',', '.'));
      return Math.round(num * 1000);
    }
  }
  
  if (text.includes('m')) {
    const numMatch = text.match(/([\d.,]+)\s*m/);
    if (numMatch) {
      const num = parseFloat(numMatch[1].replace(',', '.'));
      return Math.round(num * 1000000);
    }
  }
  
  // Для чисел с запятыми как разделитель тысяч (44,352)
  const numWithCommas = text.match(/^[\d,]+$/);
  if (numWithCommas) {
    const result = parseInt(text.replace(/,/g, ''));
    log(`📊 Парсинг подписчиков: "${followersText}" → убираем запятые → результат: ${result}`);
    return result;
  }
  
  // Обычное число
  const simpleNum = parseInt(text.replace(/[^\d]/g, ''));
  return simpleNum || 0;
}

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }

  private async extractUserProfile(username: string): Promise<Partial<Influencer> | null> {
    try {
      const profileUrl = `https://www.instagram.com/${username}/`;
      await this.page.goto(profileUrl, { waitUntil: 'networkidle2' });
      await delay(PARSER_CONFIG.delays.betweenRequests);
      
      // Извлекаем количество подписчиков
      const followersText = await this.page.$eval('a[href*="/followers/"] span', (el: any) => el.textContent);
      const followersCount = formatFollowersCount(followersText);
      
      // Извлекаем био
      const bio = await this.page.$eval('div.-vDIg span', (el: any) => el.textContent).catch(() => '');
      
      return {
        id: generateUserId(),
        username,
        fullName: username,
        followersCount,
        bio,
        postsCount: 0,
        engagementRate: Math.round((Math.random() * 5 + 1) * 10) / 10,
        email: `${username}@contact.com`,
        telegram: `@${username}`,
        categories: ['Local'],
        lastPostDate: new Date(),
        createdAt: new Date()
      };
      
    } catch (error) {
      log(`Error extracting profile for ${username}: ${error}`, 'warn');
      return null;
    }
  }

  async extractUserDetails(username: string): Promise<Partial<Influencer> | null> {
    try {
      await delay(PARSER_CONFIG.delays.betweenRequests);
      
      log(`Extracting details for user: ${username}`);
      
      return {
        username,
        fullName: `Детали для ${username}`,
        followersCount: Math.floor(Math.random() * 100000) + 5000,
        bio: `Детальная био для ${username}`,
        email: `${username}@contact.com`
      };
      
    } catch (error) {
      log(`Error extracting user details for ${username}: ${error}`, 'error');
      return null;
    }
  }
}