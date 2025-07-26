// frontend/src/types/api.ts

export interface Influencer {
  username: string;
  followersCount?: number;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  reelsViews?: string[];
  lastUpdated?: string;
  foundInLocation?: {
    name: string;
    url: string;
    id: string;
  };
}

export interface SearchResponse {
  success: boolean;
  data: {
    city: string;
    locationsSearched: number;
    influencers: Influencer[];
    totalFound: number;
    newlyParsed: number;
    fromCache: boolean;
    processedLocations?: {
      name: string;
      url: string;
      id: string;
    }[];
  };
}

export interface ProfileResponse {
  success: boolean;
  data: Partial<Influencer>;
}

export interface Country {
  code: string;
  name: string;
  url: string;
}

export interface City {
  id: string;
  name: string;
  country: string;
  url: string;
}

export interface Location {
  id: string;
  name: string;
  city: string;
  url: string;
}