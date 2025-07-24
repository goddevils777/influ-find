export interface Influencer {
  id: string;
  username: string;
  fullName: string;
  followersCount: number;
  postsCount: number;
  engagementRate: number;
  bio: string;
  email?: string;
  telegram?: string;
  cityId: string;
  categories: string[];
  lastPostDate: Date;
  createdAt: Date;
  lastUpdated?: string;
}

export interface City {
  id: string;
  name: string;
  country: string;
  parsedAt: Date;
  status: 'queued' | 'processing' | 'completed';
  locationsCount: number;
  influencersFound: number;
}