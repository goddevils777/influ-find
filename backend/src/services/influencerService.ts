import { Influencer, City } from '../models/influencer';
import { InstagramParser } from '../parsers/instagram';


export class InfluencerService {
  private parser: InstagramParser;

  constructor(useGuestMode: boolean = false) {
    this.parser = new InstagramParser(useGuestMode);
  }

  async getInfluencersByCity(cityName: string): Promise<Influencer[]> {
    // Убираем все тестовые данные - используем только реальный парсер
    try {
      const result = await this.parser.parseCity(cityName);
      return result.influencers.map((inf: any) => ({
        ...inf,
        cityId: cityName.toLowerCase()
      })) as Influencer[];
    } catch (error) {
      console.error(`Parse error for ${cityName}:`, error);
      return [];
    }
  }

  async addInfluencer(influencer: Influencer): Promise<void> {
    // Метод для будущего добавления в базу данных
    console.log('Influencer added:', influencer.username);
  }

  async parseNewCity(cityName: string): Promise<Influencer[]> {
    // Принудительный парсинг нового города
    try {
      const result = await this.parser.parseCity(cityName);
      return result.influencers as Influencer[];
    } catch (error) {
      console.error(`Failed to parse city ${cityName}:`, error);
      throw error;
    }
  }
}