import { LeagueConfig } from './types';

// export const LEAGUES: LeagueConfig[] = [
//   {
//     name: 'premier-league',
//     baseUrl: 'https://uk.soccerway.com/national/england/premier-league',
//     seasons: ['20202021', '20212022', '20222023', '20232024', '20242025']
//   },
//   {
//     name: 'championship',
//     baseUrl: 'https://uk.soccerway.com/national/england/championship',
//     seasons: ['20202021', '20212022', '20222023', '20232024', '20242025']
//   },
//   // Add other leagues similarly
// ];

export const LEAGUES: LeagueConfig[] = [
  {
    name: 'premier-league',
    baseUrl: 'https://uk.soccerway.com/national/england/premier-league',
    seasons: ['20202021']
  },
  // Add other leagues similarly
];

export const SCRAPER_CONFIG = {
  minDelay: 5000,  // Increased delays
  maxDelay: 10000,
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
  ],
  // Get a random user agent
  get userAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }
}; 