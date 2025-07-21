export const PARSER_CONFIG = {
  // Настройки задержек
  delays: {
    betweenRequests: 8000,    
    pageLoad: 5000,           
    randomDelay: 3000,        
    betweenCities: 15000,     
    errorDelay: 30000,
    proxyRotationDelay: 60000,
    cooldownPause: 300000     // 5 минут пауза
  },

  // Лимиты парсинга
  limits: {
    locationsPerCity: 100,    
    postsPerLocation: 500,    
    minFollowers: 5000,
    maxPagesPerCity: 1000,    
    requestsBeforeCooldown: 20, // Пауза каждые 20 запросов
    requestsBeforeProxyChange: 50 
  },

  // Список прокси серверов (добавь свои)
  proxies: [
    // Примеры прокси (замени на рабочие)
    'http://username:password@proxy1.example.com:8080',
    'http://username:password@proxy2.example.com:8080',
    'http://username:password@proxy3.example.com:8080',
    // Можно добавить больше прокси
  ],

  // User Agents для ротации
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0'
  ]
};