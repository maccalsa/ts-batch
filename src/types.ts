export interface MatchData {
  url: string;
  season: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  date: string;
}

export interface LeagueConfig {
  name: string;
  baseUrl: string;
  seasons: string[];
} 