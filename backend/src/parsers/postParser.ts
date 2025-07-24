// backend/src/parsers/postParser.ts
import { PARSER_CONFIG } from '../config/parser';
import { delay, randomDelay, log, formatFollowersCount, generateUserId } from '../utils/helpers';
import { Influencer } from '../models/influencer';
import { LocationCache } from './locationCache';
import { HumanBehavior } from '../utils/humanBehavior';
import { ActivityMonitor } from '../utils/activityMonitor';
import { ParsingOffset } from '../utils/parsingOffset';
import { ParsingCheckpoint, CheckpointData } from '../utils/parsingCheckpoint';

export class PostParser {
  private page: any;
  private cache: LocationCache;
  private offset: ParsingOffset;
  private checkpoint: ParsingCheckpoint;

  constructor(page: any) {
    this.page = page;
    this.cache = new LocationCache();
    this.offset = new ParsingOffset();
    this.checkpoint = new ParsingCheckpoint();
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

    // ПРОВЕРЯЕМ CHECKPOINT ПЕРЕД НАЧАЛОМ
    let resumeFromCheckpoint = false;
    let allInfluencers: any[] = [];
    let startPostIndex = 0;
    
    if (!forceRefresh) {
      const savedCheckpoint = this.checkpoint.loadCheckpoint(locationId);
      if (savedCheckpoint && savedCheckpoint.locationUrl === locationUrl) {
        log(`🔄 ВОССТАНОВЛЕНИЕ ИЗ CHECKPOINT:`);
        log(`   Последний обработанный пост: ${savedCheckpoint.currentPostIndex}/${savedCheckpoint.totalPosts}`);
        log(`   Найдено ранее: ${savedCheckpoint.foundInfluencers.length} инфлюенсеров`);
        log(`   Время сохранения: ${savedCheckpoint.timestamp}`);
        
        resumeFromCheckpoint = true;
        allInfluencers = [...savedCheckpoint.foundInfluencers];
        startPostIndex = savedCheckpoint.currentPostIndex;
        
        log(`✅ Продолжаем парсинг с поста ${startPostIndex + 1}`);
      }
    }

    // ПОЛУЧАЕМ ТЕКУЩИЙ OFFSET
    const savedOffset = this.offset.getOffset(locationId);
    log(`🔍 Получен сохраненный offset для локации ${locationId}: ${savedOffset}`);
    const currentOffset = resumeFromCheckpoint ? startPostIndex : (forceRefresh ? 0 : savedOffset);
    log(`📊 Используем offset: ${currentOffset} (resumeFromCheckpoint: ${resumeFromCheckpoint}, forceRefresh: ${forceRefresh})`);
    const stats = this.offset.getStats(locationId);
    
    log(`📊 Локация ${locationId}: начинаем с поста ${currentOffset + 1}`);

    // УСТАНАВЛИВАЕМ ОБРАБОТЧИК ЭКСТРЕННОГО СОХРАНЕНИЯ
    const emergencyHandler = () => {
      log(`🚨 ЭКСТРЕННОЕ ЗАКРЫТИЕ ОБНАРУЖЕНО!`);
      if (allInfluencers.length > 0) {
        const emergencyData: CheckpointData = {
          locationId,
          locationUrl,
          currentPostIndex: currentOffset,
          totalPosts: maxPosts,
          foundInfluencers: allInfluencers,
          lastProcessedPost: locationUrl,
          timestamp: new Date().toISOString(),
          sessionId: ''
        };
        this.checkpoint.emergencySave(emergencyData);
      }
    };

    // Обработчики для экстренного сохранения
    process.on('SIGINT', emergencyHandler);
    process.on('SIGTERM', emergencyHandler);
    process.on('uncaughtException', emergencyHandler);

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
log(`🔧 Параметры поиска постов: maxPosts=${maxPosts}, currentOffset=${currentOffset}`);

const posts = await this.page.evaluate((maxPosts: number, offset: number) => {
  console.log(`🔍 JS: Ищем посты - maxPosts=${maxPosts}, offset=${offset}`);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            console.log(`Всего ссылок на странице: ${allLinks.length}`);
            
            const postLinks = allLinks
              .filter((link: any) => {
                const href = link.href || '';
                return href.includes('/p/') || href.includes('/reel/');
              })
              .slice(offset, offset + maxPosts)
              .map((link: any) => link.href);
            
            console.log(`Найдено ссылок с offset ${offset}: ${postLinks.length}`);
            resolve(postLinks);
          }, 3000);
        });
      }, maxPosts, currentOffset);

      log(`📸 Найдено ${posts.length} постов начиная с позиции ${currentOffset + 1}`);

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

      const newInfluencers: Partial<Influencer>[] = [];
      let newUsersFound = 0;
      let skippedDuplicates = 0;
      
      // ОБНОВЛЕННЫЙ ЦИКЛ С CHECKPOINT'АМИ
      for (let i = 0; i < posts.length; i++) {
        try {
          const currentPostIndex = currentOffset + i;
          const postUrl = posts[i];
          
          // АВТОСОХРАНЕНИЕ КАЖДЫЕ 3 ПОСТА
          if (allInfluencers.length > 0 && currentPostIndex % 3 === 0) {
            const checkpointData: CheckpointData = {
              locationId,
              locationUrl,
              currentPostIndex,
              totalPosts: posts.length,
              foundInfluencers: allInfluencers,
              lastProcessedPost: postUrl,
              timestamp: new Date().toISOString(),
              sessionId: ''
            };
            
            this.checkpoint.autoSave(checkpointData, 3);
          }

          log(`📄 Парсим пост ${currentPostIndex + 1}: ${postUrl}`);
          
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
            
            if (allInfluencers.find(inf => inf.username === username)) {
              log(`⏭️ Пропускаем @${username} - уже добавлен в текущей сессии`);
              continue;
            }
            
            log(`🆕 Новый пользователь: @${username}, проверяем подписчиков...`);

            // СНАЧАЛА БЫСТРО ПРОВЕРЯЕМ ПОДПИСЧИКОВ НА ГЛАВНОЙ СТРАНИЦЕ
            const mainProfileUrl = `https://www.instagram.com/${username}/`;
            log(`🔍 Быстрая проверка подписчиков: ${mainProfileUrl}`);

            await this.page.goto(mainProfileUrl, { waitUntil: 'networkidle2', timeout: 10000 });
            await HumanBehavior.smartDelay();

            // Быстро извлекаем только количество подписчиков
            const followersCheck = await this.page.evaluate(() => {
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
              
              return { followersText };
            });

            const followersCount = this.parseFollowersCount(followersCheck.followersText);
            log(`👥 Подписчики @${username}: ${followersCount}`);

            // РАННЯЯ ПРОВЕРКА - ЕСЛИ МАЛО ПОДПИСЧИКОВ, ПРОПУСКАЕМ
            if (followersCount < PARSER_CONFIG.limits.minFollowers) {
              log(`⏭️ Пропущен @${username} (${followersCount} подписчиков - меньше минимума) - БЕЗ ПАРСИНГА BIO И REELS`);
              continue;
            }

            // ЕСЛИ ПОДПИСЧИКОВ ДОСТАТОЧНО - ПРОДОЛЖАЕМ ПОЛНЫЙ ПАРСИНГ
            log(`✅ @${username} подходит (${followersCount} подписчиков), собираем полные данные...`);

            // ТЕПЕРЬ СОБИРАЕМ BIO
            log(`📝 Собираем био @${username}...`);
            const mainPageBio = await this.page.evaluate(() => {
              let bio = '';
              const bioSelectors = [
                'div[class*="_a6hd"] span',
                'header section div span',
                '[data-testid="user-description"] span',
                'span[class*="_ap3a"]',
                'span[class*="_aaco"]',
                'article header div div span',
                'header div span'
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

            log(`📝 Био: "${mainPageBio}"`);

            // ПЕРЕХОДИМ НА REELS ДЛЯ СБОРА СТАТИСТИКИ
            const reelsUrl = `https://www.instagram.com/${username}/reels/`;
            log(`👀 Изучаем reels @${username}...`);

            await HumanBehavior.smartDelay();
            await this.page.goto(reelsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
            await HumanBehavior.smartDelay();
            await HumanBehavior.humanScroll(this.page);

            // Извлекаем данные профиля с reels страницы
            const profileData = await this.page.evaluate(() => {
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
                  break;
                }
              }
              
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
              
              const reelsStats = reelsVideos.slice(0, 4).map((reel: any) => {
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

              
              
              // Аватарка - добавляем парсинг
            let avatarUrl = '';
            const avatarSelectors = [
            'img[alt*="profile picture"]',
            'img[data-testid="user-avatar"]', 
            'header img',
            'img[alt*="\'s profile picture"]'
            ];

            for (const selector of avatarSelectors) {
            const avatarEl = document.querySelector(selector);
            if (avatarEl) {
                const src = avatarEl.getAttribute('src');
                if (src && src.includes('http')) {
                avatarUrl = src;
                break;
                }
            }
            }

            return {
            followersText,
            fullName,
            reelsStats,
            avatarUrl
            };
            });

            const finalBio = mainPageBio || 'Описание не указано';

            log(`👤 Итоговые данные профиля @${username}:`);
            log(`   Подписчики: ${followersCount}`);
            log(`   Био: ${finalBio}`);
            log(`   Имя: ${profileData.fullName}`);
            log(`   Reels: ${profileData.reelsStats.length}`);

            const finalFollowersCount = this.parseFollowersCount(profileData.followersText) || followersCount;

            const influencer = {
              username: username,
              fullName: profileData.fullName || username,
              followersCount: finalFollowersCount,
              bio: finalBio,
              avatarUrl: profileData.avatarUrl || '',
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

            // ДОБАВЛЯЕМ ЛОГИРОВАНИЕ АВАТАРКИ
log(`📷 Аватарка для @${username}: ${profileData.avatarUrl ? 'НАЙДЕНА' : 'НЕ НАЙДЕНА'}`);
if (profileData.avatarUrl) {
  log(`   URL: ${profileData.avatarUrl.substring(0, 80)}...`);
}
            
            newInfluencers.push(influencer);
            allInfluencers.push(influencer);
            newUsersFound++;
            
            const viewsList = profileData.reelsStats.map((reel: any) => reel.views).join(', ');
            log(`✅ Добавлен новый инфлюенсер: @${username} (${finalFollowersCount.toLocaleString()} подписчиков, аватарка: ${influencer.avatarUrl ? 'ЕСТЬ' : 'НЕТ'}, просмотры: ${viewsList})`);
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
    // СОХРАНЯЕМ НОВЫЙ OFFSET И СТАТИСТИКУ
    const newOffset = currentOffset + posts.length;
    log(`💾 Сохраняем offset для локации ${locationId}: старый=${currentOffset}, новый=${newOffset}`);
    this.offset.saveOffset(locationId, newOffset, stats.totalParsed + newUsersFound);
    log(`✅ Offset сохранен успешно`);
      
      // ОБНОВЛЯЕМ КЭШ - ИСПРАВЛЕННАЯ ЛОГИКА
        // ОБНОВЛЯЕМ КЭШ - ПРАВИЛЬНАЯ ЛОГИКА
        if (newInfluencers.length > 0) {
        // Получаем существующие данные из кэша
        const existingInfluencers = this.cache.getCache(locationId) || [];
        
        log(`📊 Текущее состояние кэша: ${existingInfluencers.length} инфлюенсеров`);
        log(`📊 Найдено новых: ${newInfluencers.length} инфлюенсеров`);
        
        // Объединяем старые и новые, убирая дубликаты по username
        const allInfluencersForLocation = [...existingInfluencers, ...newInfluencers];
        const uniqueInfluencersForLocation = allInfluencersForLocation.filter((inf, index, self) => 
            index === self.findIndex(i => i.username === inf.username)
        );
        
        log(`📊 Итого уникальных после объединения: ${uniqueInfluencersForLocation.length}`);
        
        // Сохраняем объединенный список
        this.cache.saveCache(locationId, uniqueInfluencersForLocation);
        
        log(`💾 Обновлен кэш для локации ${locationId}: ${uniqueInfluencersForLocation.length} инфлюенсеров (${newInfluencers.length} новых)`);
      }

      // ОЧИЩАЕМ CHECKPOINT ПОСЛЕ УСПЕШНОГО ЗАВЕРШЕНИЯ
      this.checkpoint.clearCheckpoint(locationId);
      
      log(`📊 Статистика парсинга:`);
      log(`   🆕 Найдено новых: ${newUsersFound}`);
      log(`   ⏭️ Пропущено дубликатов: ${skippedDuplicates}`);
      log(`   📍 Новый offset: ${newOffset}`);
      log(`   📍 Всего инфлюенсеров: ${allInfluencers.length}`);
      log(`   ⏱️ Время выполнения: ${Date.now() - startTime}мс`);
      
      return newInfluencers;
      
    } catch (error) {
      log(`❌ Ошибка парсинга локации: ${error}`, 'error');
      return [];
    } finally {
      // Убираем обработчики экстренного сохранения
      process.removeListener('SIGINT', emergencyHandler);
      process.removeListener('SIGTERM', emergencyHandler);
      process.removeListener('uncaughtException', emergencyHandler);
    }
  }

  private extractLocationId(locationUrl: string): string | null {
    const match = locationUrl.match(/\/locations\/(\d+)\//);
    return match ? match[1] : null;
  }

  private extractLocationName(locationUrl: string): string {
    try {
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