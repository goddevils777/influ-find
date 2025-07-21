export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const randomDelay = (min: number, max: number): Promise<void> => {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return delay(ms);
};

export const formatFollowersCount = (count: string): number => {
  const cleanCount = count.replace(/[^\d.KMkm]/g, '');
  
  if (cleanCount.includes('K') || cleanCount.includes('k')) {
    return Math.floor(parseFloat(cleanCount) * 1000);
  }
  if (cleanCount.includes('M') || cleanCount.includes('m')) {
    return Math.floor(parseFloat(cleanCount) * 1000000);
  }
  
  return parseInt(cleanCount) || 0;
};

export const generateUserId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const log = (message: string, level: 'info' | 'error' | 'warn' = 'info'): void => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
};