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
  private guestMode: boolean;

  constructor(guestMode: boolean = false) {
    log(`🔧 InstagramParser создается с guestMode: ${guestMode}`);
    this.guestMode = guestMode;
  }

  async init(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      this.locationParser = new LocationParser(this.guestMode);
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
    
    // Остальной код парсинга...
    
    return {
      city: cityName,
      influencers: [],
      status: 'completed',
      parsedAt: new Date(),
      locationsAnalyzed: locations.length,
      totalFound: 0
    };
    
  } catch (error) {
    log(`Parse error for ${cityName}: ${error}`, 'error');
    throw error;
  } finally {
    this.isRunning = false;
    // ДОБАВЬ АВТОМАТИЧЕСКОЕ ЗАКРЫТИЕ БРАУЗЕРА
    if (this.locationParser) {
      log(`🔄 Закрываем браузер после парсинга города ${cityName}`);
      await this.locationParser.close();
      this.locationParser = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    log(`✅ Браузер закрыт после парсинга города ${cityName}`);
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