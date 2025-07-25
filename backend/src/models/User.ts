export interface User {
  id: string;
  email: string;
  password: string; // хешированный
  name: string;
  createdAt: Date;
  instagramConnected: boolean;
  instagramUsername?: string;
  proxyConnected: boolean;
  proxyConfig?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  instagramConnected: boolean;
  proxyConnected: boolean;
}