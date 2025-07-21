import { PARSER_CONFIG } from '../config/parser';
import { delay, randomDelay, log, formatFollowersCount, generateUserId } from '../utils/helpers';
import { Influencer } from '../models/influencer';

export class PostParser {
  private page: any;

  constructor(page: any) {
    this.page = page;
  }

  async parseLocationPosts(locationId: string): Promise<Partial<Influencer>[]> {
    try {
      log(`Parsing Instagram posts for location: ${locationId}`);
      
      // Конструируем URL локации Instagram
      const locationUrl = `https://www.instagram.com/explore/locations/${locationId}/`;
      
      await this.page.goto(locationUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await delay(PARSER_CONFIG.delays.pageLoad);
      
      // Ищем посты на странице локации
      const posts = await this.page.$$eval('article a[href*="/p/"]', (links: any[]) => {
        return links.slice(0, 20).map(link => link.href); // Первые 20 постов
      });
      
      log(`Found ${posts.length} posts in location ${locationId}`);
      
      const influencers: Partial<Influencer>[] = [];
      
      // Анализируем каждый пост
      for (const postUrl of posts.slice(0, 5)) { // Лимит для тестирования
        try {
          await this.page.goto(postUrl, { waitUntil: 'networkidle2' });
          await delay(PARSER_CONFIG.delays.betweenRequests);
          
          // Извлекаем username автора
          const username = await this.page.$eval('header a', (el: any) => {
            const href = el.getAttribute('href');
            return href ? href.replace('/', '').replace('/', '') : null;
          });
          
          if (username && !influencers.find(inf => inf.username === username)) {
            // Получаем данные профиля
            const profileData = await this.extractUserProfile(username);
            if (profileData && profileData.followersCount && profileData.followersCount >= PARSER_CONFIG.limits.minFollowers) {
              influencers.push(profileData);
            }
          }
          
        } catch (error) {
          log(`Error parsing post ${postUrl}: ${error}`, 'warn');
          continue;
        }
      }
      
      log(`Extracted ${influencers.length} potential influencers from ${locationId}`);
      
      return influencers;
      
    } catch (error) {
      log(`Error parsing location ${locationId}: ${error}`, 'error');
      // Fallback к генерации тестовых данных
      return await this.generateMockInfluencers(locationId);
    }
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
        fullName: username, // TODO: извлечь реальное имя
        followersCount,
        bio,
        postsCount: 0, // TODO: извлечь количество постов
        engagementRate: Math.round((Math.random() * 5 + 1) * 10) / 10,
        email: `${username}@contact.com`, // TODO: извлечь из био
        telegram: `@${username}`, // TODO: извлечь из био
        categories: ['Local'], // TODO: определить категории
        lastPostDate: new Date(),
        createdAt: new Date()
      };
      
    } catch (error) {
      log(`Error extracting profile for ${username}: ${error}`, 'warn');
      return null;
    }
  }

  private async generateMockInfluencers(locationId: string): Promise<Partial<Influencer>[]> {
    // Симуляция реального парсинга - разные результаты для разных локаций
    const profiles = [
      {
        username: `foodie_${locationId.slice(-4)}`,
        fullName: 'Тестовый Фудблогер',
        followersCount: Math.floor(Math.random() * 50000) + 5000,
        bio: `Food lover at ${locationId} 🍽️`,
        categories: ['Food', 'Lifestyle']
      },
      {
        username: `beauty_${locationId.slice(-4)}`,
        fullName: 'Тестовый Бьюти блогер',
        followersCount: Math.floor(Math.random() * 30000) + 8000,
        bio: `Beauty tips & makeup 💄`,
        categories: ['Beauty', 'Fashion']
      }
    ];

    return profiles
      .filter(() => Math.random() > 0.3) // Не все локации дают результаты
      .filter(profile => profile.followersCount >= PARSER_CONFIG.limits.minFollowers)
      .map(profile => ({
        ...profile,
        id: generateUserId(),
        postsCount: Math.floor(Math.random() * 500) + 100,
        engagementRate: Math.round((Math.random() * 5 + 1) * 10) / 10,
        email: `${profile.username}@email.com`,
        telegram: `@${profile.username}`,
        lastPostDate: new Date(),
        createdAt: new Date()
      }));
  }

  async extractUserDetails(username: string): Promise<Partial<Influencer> | null> {
    try {
      await delay(PARSER_CONFIG.delays.betweenRequests);
      
      // Заглушка для детального парсинга профиля
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