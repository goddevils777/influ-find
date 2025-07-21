import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { LocationParser } from './locationParser';
import { PostParser } from './postParser';
import { PARSER_CONFIG } from '../config/parser';
import { log } from '../utils/helpers';
import { Influencer } from '../models/influencer';

puppeteer.use(StealthPlugin());

export class InstagramParser {
  private isRunning: boolean = false;
  private browser: any = null;
  private locationParser: LocationParser | null = null;

  async init(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      this.locationParser = new LocationParser();
      await this.locationParser.init();
      
      log('InstagramParser fully initialized');
    } catch (error) {
      log(`Parser initialization failed: ${error}`, 'error');
      throw error;
    }
  }

  async parseCity(cityName: string): Promise<any> {
    log(`Starting full parse for city: ${cityName}`);
    this.isRunning = true;
    
    try {
      if (!this.locationParser) await this.init();
      
      // Шаг 1: Найти топ локации в городе
      const locations = await this.locationParser!.findTopLocations(cityName);
      log(`Found ${locations.length} locations for parsing`);
      
      // Шаг 2: Парсить посты в каждой локации
      const allInfluencers: Partial<Influencer>[] = [];
      
      for (const location of locations.slice(0, 5)) { // Лимит для MVP
        const page = await this.browser.newPage();
        const postParser = new PostParser(page);
        
        const influencers = await postParser.parseLocationPosts(location);
        allInfluencers.push(...influencers);
        
        await page.close();
        log(`Processed location ${location}, found ${influencers.length} influencers`);
      }
      
      // Шаг 3: Убрать дубликаты и отфильтровать
      const uniqueInfluencers = this.removeDuplicates(allInfluencers);
      const filteredInfluencers = uniqueInfluencers.filter(inf => 
        inf.followersCount! >= PARSER_CONFIG.limits.minFollowers
      );
      
      log(`Parse completed: ${filteredInfluencers.length} unique influencers found`);
      
      return {
        city: cityName,
        influencers: filteredInfluencers,
        status: 'completed',
        parsedAt: new Date(),
        locationsAnalyzed: locations.length,
        totalFound: filteredInfluencers.length
      };
      
    } catch (error) {
      log(`Parse error for ${cityName}: ${error}`, 'error');
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  private removeDuplicates(influencers: Partial<Influencer>[]): Partial<Influencer>[] {
    const seen = new Set();
    return influencers.filter(inf => {
      if (seen.has(inf.username)) return false;
      seen.add(inf.username);
      return true;
    });
  }

  getStatus(): boolean {
    return this.isRunning;
  }

  async close(): Promise<void> {
    if (this.locationParser) {
      await this.locationParser.close();
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    log('InstagramParser closed');
  }
}