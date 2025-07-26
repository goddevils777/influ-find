export interface Influencer {
  id: string;
  username: string;
  fullName?: string;
  bio?: string;
  followersCount?: number;
  postsCount?: number;
  categories?: string[];
  contactInfo?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  reelsViews?: string[];
  foundInLocation?: {
    id: string;
    name: string;
    url: string;
  };
  cityId?: string;
  avatarUrl?: string;
  lastUpdated?: string;
}