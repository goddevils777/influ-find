import { PARSER_CONFIG } from '../config/parser';
import { delay, randomDelay, log, formatFollowersCount, generateUserId } from '../utils/helpers';
import { Influencer } from '../models/influencer';
import { LocationCache } from './locationCache';
import { HumanBehavior } from '../utils/humanBehavior';
import { ActivityMonitor } from '../utils/activityMonitor';
import { ParsingOffset } from '../utils/parsingOffset';

export class PostParser {
  private page: any;
  private cache: LocationCache;
  private offset: ParsingOffset;

  constructor(page: any) {
    this.page = page;
    this.cache = new LocationCache();
    this.offset = new ParsingOffset();
  }

  // Проверка дубликатов
  private async checkIfUserExists(username: string, locationId: string): Promise<boolean> {
    try {
      const existingInfluencers = this.cache.getCache(locationId) || [];
      return existingInfluencers.some((inf: any) => inf.username === username);
    } catch (error) {
      return false;
    }
  }

  async parseLocationPosts(locationUrl: string, maxPosts: number = 10, forceRefresh: boolean = false): Promise<Partial<Influencer>[]> {
    const startTime = Date.now();
    const locationId = this.extractLocationId(locationUrl);
    
    if (!locationId) {
      log(`❌ Не удалось извлечь ID локации из URL: ${locationUrl}`, 'error');
      return [];
    }

    // ПОЛУЧАЕМ ТЕКУЩИЙ OFFSET
    const currentOffset = forceRefresh ? this.offset.getOffset(locationId) : 0;
    const stats = this.offset.getStats(locationId);
    
    log(`📊 Локация ${locationId}: уже обработано ${stats.totalParsed} пользователей, начинаем с поста ${currentOffset + 1}`);

    try {
      // Проверяем активность
      await ActivityMonitor.emergencyBreak();
      
      if (!ActivityMonitor.checkRequestRate()) {
        log('⏸️ Пропускаем запрос из-за высокой активности', 'warn');
        await HumanBehavior.smartDelay();
      }

      await this.page.goto(locationUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Человекоподобное поведение
      await HumanBehavior.smartDelay();
      await HumanBehavior.humanScroll(this.page);
      await HumanBehavior.humanMouseMove(this.page);

      // ЕДИНЫЙ БЛОК ПОИСКА ПОСТОВ С OFFSET
      const posts = await this.page.evaluate((maxPosts: number, offset: number) => {
        console.log(`🔍 Ищем посты начиная с позиции ${offset + 1}`);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            console.log(`Всего ссылок на странице: ${allLinks.length}`);
            
            const postLinks = allLinks
              .filter((link: any) => {
                const href = link.href || '';
                return href.includes('/p/') || href.includes('/reel/');
              })
              .slice(offset, offset + maxPosts) // ПРИМЕНЯЕМ OFFSET
              .map((link: any) => link.href);
            
            console.log(`Найдено ссылок с offset ${offset}: ${postLinks.length}`);
            resolve(postLinks);
          }, 3000);
        });
      }, maxPosts, currentOffset);

      log(`📸 Найдено ${posts.length} постов начиная с позиции ${currentOffset + 1}`);

      // Если постов нет - логируем отладку
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
      let newUsersFound = 0;
      let skippedDuplicates = 0;
      
      // ОБНОВЛЕННЫЙ ЦИКЛ С ПРОВЕРКОЙ ДУБЛИКАТОВ
      for (let i = 0; i < posts.length; i++) {
        try {
          const postUrl = posts[i];
          log(`📄 Парсим пост ${currentOffset + i + 1}: ${postUrl}`);
          
          await HumanBehavior.smartDelay();
          
          await this.page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          
          await HumanBehavior.smartDelay();
          await HumanBehavior.humanMouseMove(this.page);
          
          // Извлекаем username автора поста
          const username = await this.page.evaluate(() => {
            const usernameLink = document.querySelector('header a[role="link"]');
            if (usernameLink) {
              const href = usernameLink.getAttribute('href');
              return href ? href.replace(/\//g, '') : null;
            }
            return null;
          });
          
          if (username) {
            // ПРОВЕРЯЕМ ДУБЛИКАТЫ
            const userExists = await this.checkIfUserExists(username, locationId);
            
            if (userExists) {
              log(`⏭️ Пропускаем @${username} - уже есть в базе`);
              skippedDuplicates++;
              continue;
            }
            
            if (influencers.find(inf => inf.username === username)) {
              log(`⏭️ Пропускаем @${username} - уже добавлен в текущей сессии`);
              continue;
            }
            
            log(`🆕 Новый пользователь: @${username}, проверяем основную страницу...`);
            
            // ДОПОЛНИТЕЛЬНО: получаем био с основной страницы профиля
            const mainProfileUrl = `https://www.instagram.com/${username}/`;
            log(`🔍 Проверяем основную страницу профиля: ${mainProfileUrl}`);

            await this.page.goto(mainProfileUrl, { waitUntil: 'networkidle2', timeout: 10000 });
            await HumanBehavior.smartDelay();

            const mainPageBio = await this.page.evaluate(() => {
              // Расширенный поиск био на главной странице
              let bio = '';
              const bioSelectors = [
                'div[class*="_a6hd"] span',
                'header section div span',
                'div[data-testid="user-description"] span',
                'span[class*="_ap3a"]',
                'span[class*="_aaco"]',
                '[role="text"] span',
                'article header + div span'
              ];

              for (const selector of bioSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                  const text = element.textContent?.trim() || '';
                  if (text.length > bio.length && 
                      text.length > 10 && 
                      text.length < 1000 && 
                      !text.includes('подписчик') && 
                      !text.includes('публикац') &&
                      !text.match(/^\d+$/) &&
                      !text.match(/^@\w+$/)) {
                    bio = text;
                  }
                }
              }

              // Если не нашли, ищем в мета-тегах
              if (!bio || bio.length < 20) {
                const metaDescription = document.querySelector('meta[name="description"]');
                if (metaDescription) {
                  const metaText = metaDescription.getAttribute('content') || '';
                  if (metaText.length > bio.length && metaText.length < 500) {
                    bio = metaText;
                  }
                }
              }

              return bio;
            });

            log(`📝 Био с главной страницы: "${mainPageBio}"`);
            
            // Переходим на reels
            const reelsUrl = `https://www.instagram.com/${username}/reels/`;
            
            await HumanBehavior.smartDelay();
            log(`👀 Изучаем reels @${username}...`);
            
            await this.page.goto(reelsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
            
            await HumanBehavior.smartDelay();
            await HumanBehavior.humanScroll(this.page);
            
            // Извлекаем данные профиля с reels страницы
            const profileData = await this.page.evaluate(() => {
              console.log('=== ОТЛАДКА ПРОФИЛЯ НА REELS ===');
              
              // Подписчики
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
                  console.log(`Подписчики найдены: ${followersText}`);
                  break;
                }
              }
              
              // Полное имя
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
                  break;
                }
              }
              
              // Reels статистика
              const reelsSelectors = [
                'article a[href*="/reel/"]',
                'a[href*="/reel/"]',
                'div[role="button"] a[href*="/reel/"]'
              ];
              
              let reelsVideos: any[] = [];
              for (const selector of reelsSelectors) {
                reelsVideos = Array.from(document.querySelectorAll(selector));
                if (reelsVideos.length > 0) {
                  break;
                }
              }
              
              const reelsStats = reelsVideos.slice(0, 4).map((reel: any, index: number) => {
                const videoContainer = reel.closest('div') || reel.parentElement;
                let views = '0';
                
                if (videoContainer) {
                  const viewSpans = videoContainer.querySelectorAll('span.html-span, span[class*="x1lliihq"]');
                  let foundNumbers: Array<{text: string, num: number}> = [];
                  
                  for (const span of viewSpans) {
                    const text = span.textContent?.trim() || '';
                    
                    if (text.match(/^[\d,.\s]+(\s*(тыс|к|k|м|m))?\s*$/i) && !text.includes('подписчик')) {
                      let num = 0;
                      
                      if (text.toLowerCase().includes('тыс') || text.toLowerCase().includes('к') || text.toLowerCase().includes('k')) {
                        const numMatch = text.match(/[\d,\.]+/);
                        if (numMatch) {
                          const cleanNum = numMatch[0].replace(',', '.');
                          num = parseFloat(cleanNum) * 1000;
                        }
                      } else if (text.toLowerCase().includes('м') || text.toLowerCase().includes('m')) {
                        const numMatch = text.match(/[\d,\.]+/);
                        if (numMatch) {
                          const cleanNum = numMatch[0].replace(',', '.');
                          num = parseFloat(cleanNum) * 1000000;
                        }
                      } else {
                        const cleanText = text.replace(/[,\s]/g, '');
                        num = parseInt(cleanText);
                      }
                      
                      if (num >= 10) {
                        foundNumbers.push({text, num});
                      }
                    }
                  }
                  
                  if (foundNumbers.length > 0) {
                    foundNumbers.sort((a, b) => b.num - a.num);
                    views = foundNumbers[0].text;
                  }
                }
                
                return { views };
              });
              
              return {
                followersText,
                fullName,
                reelsStats
              };
            });

            // Используем био с главной страницы как приоритетное
            const finalBio = mainPageBio || 'Описание не указано';

            log(`👤 Итоговые данные профиля @${username}:`);
            log(`   Подписчики: ${profileData.followersText}`);
            log(`   Био: ${finalBio}`);
            log(`   Имя: ${profileData.fullName}`);
            log(`   Reels: ${profileData.reelsStats.length}`);
            
            const followersCount = this.parseFollowersCount(profileData.followersText);
            
            if (followersCount >= PARSER_CONFIG.limits.minFollowers) {
              const influencer = {
                username: username,
                fullName: profileData.fullName || username,
                followersCount: followersCount,
                bio: finalBio, // ИСПОЛЬЗУЕМ ПОЛНОЕ БИО
                cityId: locationId,
                id: this.generateUserId(),
                categories: ['Local'],
                reelsViews: profileData.reelsStats.map((reel: any) => reel.views),
                reelsCount: profileData.reelsStats.length,
                createdAt: new Date(),
                foundInLocation: {
                  id: locationId,
                  name: this.extractLocationName(locationUrl),
                  url: locationUrl
                }
              };
              
              influencers.push(influencer);
              newUsersFound++;
              
              const viewsList = profileData.reelsStats.map((reel: any) => reel.views).join(', ');
              log(`✅ Добавлен новый инфлюенсер: @${username} (${followersCount.toLocaleString()} подписчиков, просмотры: ${viewsList})`);
            } else {
              log(`⏭️ Пропущен @${username} (${followersCount} подписчиков - меньше минимума)`);
            }
          }
          
        } catch (error) {
          log(`❌ Ошибка парсинга поста ${currentOffset + i + 1}: ${error}`, 'error');
          continue;
        }

        // Человекоподобные перерывы
        await HumanBehavior.maybeDoTechnicalBreak();
        
        if (i > 0 && i % 3 === 0) {
          log(`☕ Делаем перерыв после ${i + 1} постов...`);
          await HumanBehavior.randomActivity(this.page);
        }

        if (Math.random() > 0.85) {
          log(`🛋️ Длинный перерыв - имитируем что отвлеклись...`);
          await HumanBehavior.humanIdle();
        }
      }
      
      // СОХРАНЯЕМ НОВЫЙ OFFSET И СТАТИСТИКУ
      const newOffset = currentOffset + posts.length;
      this.offset.saveOffset(locationId, newOffset, stats.totalParsed + newUsersFound);
      
      // ОБНОВЛЯЕМ КЭШ
      if (newUsersFound > 0) {
        const existingInfluencers = this.cache.getCache(locationId) || [];
        const combinedInfluencers = [...existingInfluencers, ...influencers];
        this.cache.saveCache(locationId, combinedInfluencers);
      }
      
      log(`📊 Статистика парсинга:`);
      log(`   🆕 Найдено новых: ${newUsersFound}`);
      log(`   ⏭️ Пропущено дубликатов: ${skippedDuplicates}`);
      log(`   📍 Новый offset: ${newOffset}`);
      log(`   ⏱️ Время выполнения: ${Date.now() - startTime}мс`);
      
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

  private extractLocationName(locationUrl: string): string {
    try {
      // Извлекаем название из URL типа /explore/locations/123/location-name/
      const match = locationUrl.match(/\/explore\/locations\/\d+\/([^\/]+)\//);
      if (match) {
        return match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
      return 'Unknown Location';
    } catch (error) {
      return 'Unknown Location';
    }
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
    
    const text = followersText.toLowerCase().trim();
    
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
    
    const numWithCommas = text.match(/^[\d,]+$/);
    if (numWithCommas) {
      return parseInt(text.replace(/,/g, ''));
    }
    
    return parseInt(text.replace(/[^\d]/g, '')) || 0;
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9);
  }
}