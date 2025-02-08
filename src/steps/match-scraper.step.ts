import { Step } from '../tsbatch';
import { ExecutionContext } from '../tsbatch/execution-context';
import puppeteer, { Browser, Page } from 'puppeteer';
import { MatchData, LeagueConfig } from '../types';
import { SCRAPER_CONFIG } from '../config';
import fs from 'fs/promises';
import path from 'path';
import { ProxyRotator } from '../utils/proxy';

export class MatchScraperStep implements Step {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private proxyRotator: ProxyRotator;

  constructor() {
    this.proxyRotator = new ProxyRotator([
      // Add your proxies here
      { host: 'proxy1.example.com', port: 8080 },
      { host: 'proxy2.example.com', port: 8080 },
    ]);
  }

  async execute(context: ExecutionContext): Promise<void> {
    try {
      await this.initBrowser();
      const allMatches: MatchData[] = [];
      const league = context.get('league') as LeagueConfig;
      for (const season of league.seasons) {
        const seasonUrl = `${league.baseUrl}/${season}/regular-season`;
        const matches = await this.scrapeSeasonMatches(seasonUrl, league.name, season);
        allMatches.push(...matches);

        // Save matches for each season
        await this.saveMatches(league.name, season, matches);
      }

      const matches = context.get('matches') as MatchData[];
      matches.push(...allMatches);
      context.set('matches', matches);
    } finally {
      await this.cleanup();
    }
  }

  private async initBrowser(): Promise<void> {
    const proxy = this.proxyRotator.getNext();
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list',
      '--user-agent=' + SCRAPER_CONFIG.userAgent,
      `--proxy-server=${this.proxyRotator.getProxyString(proxy)}`,
    ];
    this.browser = await puppeteer.launch({
      headless: true,
      args,
      ignoreDefaultArgs: ['--disable-extensions'],
    });

    this.page = await this.browser.newPage();

    // Set more realistic browser behavior
    await this.page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // Set extra headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
    });

    // Add retry logic for navigation
    this.page.setDefaultNavigationTimeout(60000); // Increase timeout to 60 seconds
  }

  private async scrapeSeasonMatches(
    seasonUrl: string,
    leagueName: string,
    season: string
  ): Promise<MatchData[]> {
    if (!this.page) throw new Error('Browser not initialized');
    
    const matches: MatchData[] = [];
    console.log(`Navigating to ${seasonUrl}`);

    // Add retry logic for initial navigation
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        await this.page.goto(seasonUrl, { 
          waitUntil: 'networkidle0',
          timeout: 60000 
        });
        break;
      } catch (error: any) {
        retryCount++;
        console.log(`Navigation attempt ${retryCount} failed:`, error.message);
        
        if (retryCount === maxRetries) {
          throw new Error(`Failed to navigate after ${maxRetries} attempts`);
        }
        
        // Wait before retrying (increasing delay with each retry)
        await new Promise(resolve => setTimeout(resolve, retryCount * 5000));
        
        // Clear cookies and cache before retrying
        const client = await this.page.target().createCDPSession();
        await client.send('Network.clearBrowserCookies');
        await client.send('Network.clearBrowserCache');
      }
    }

    // Add cookie consent handling if needed
    try {
      const cookieButton = await this.page.$('[id*="cookie"][id*="accept"]');
      if (cookieButton) {
        await cookieButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log('No cookie consent button found or error clicking it');
    }

    // Enable request interception with more detailed logging
    await this.page.setRequestInterception(true);
    
    // Store the AJAX request details when we find them
    let paginationRequestDetails: { url: string; headers: Record<string, string> } | null = null;
    
    this.page.on('request', request => {
      const url = request.url();
      if (url.includes('page_competition_1_block_competition_matches')) {
        console.log('\nPagination Request Found:');
        console.log('URL:', url);
        console.log('Headers:', request.headers());
        console.log('Method:', request.method());
        paginationRequestDetails = {
          url,
          headers: request.headers()
        };
      }
      request.continue();
    });

    this.page.on('response', async response => {
      const url = response.url();
      if (url.includes('page_competition_1_block_competition_matches')) {
        console.log('\nPagination Response:');
        console.log('Status:', response.status());
        try {
          const text = await response.text();
          console.log('Response Body:', text.substring(0, 200) + '...');
        } catch (e) {
          console.log('Could not get response body');
        }
      }
    });

    // Now let's try to find the pagination controls
    const paginationInfo = await this.page.evaluate(() => {
      const paginationElement = document.querySelector('.nav_description');
      if (!paginationElement) return null;

      return {
        html: paginationElement.innerHTML,
        nextButtonId: paginationElement.querySelector('a.next')?.id,
        prevButtonId: paginationElement.querySelector('a.previous')?.id,
        dataAttributes: Array.from(paginationElement.querySelectorAll('a')).map(a => ({
          id: a.id,
          rel: a.getAttribute('rel'),
          class: a.className
        }))
      };
    });

    console.log('\nPagination Controls Found:', paginationInfo);

    let hasMorePages = true;
    let pageCount = 1;
    
    while (hasMorePages) {
      console.log(`\n=== Scraping page ${pageCount} of matches ===`);
      
      const matchElements = await this.page.$$('td.score-time');
      console.log(`Found ${matchElements.length} match elements on page`);

      // Extract matches from current page
      const pageMatches = await this.page.evaluate(() => {
        const matchElements = document.querySelectorAll('td.score-time a');
        return Array.from(matchElements).map(el => {
          const url = el.getAttribute('href') || '';
          const scoreElement = el.querySelector('.extra_time_score');
          const score = scoreElement ? scoreElement.textContent?.trim() || '' : '';
          
          // Extract teams and date from URL
          const urlParts = url.split('/');
          const homeTeam = urlParts[urlParts.length - 3] || '';
          const awayTeam = urlParts[urlParts.length - 2] || '';
          const date = urlParts[urlParts.length - 4] || ''; // Format: YYYY/MM/DD

          return { url, score, homeTeam, awayTeam, date };
        });
      });

      console.log(`Found ${pageMatches.length} matches on page ${pageCount}`);

      // Process matches
      matches.push(...pageMatches.map(match => ({
        url: match.url,
        score: match.score,
        season,
        league: leagueName,
        homeTeam: match.homeTeam.replace(/-/g, ' '),
        awayTeam: match.awayTeam.replace(/-/g, ' '),
        date: match.date
      })));

      // Try the AJAX approach for pagination
      hasMorePages = await this.goToNextPageAjax(pageCount, paginationRequestDetails);
      if (hasMorePages) {
        pageCount++;
        await this.randomDelay();
      }
    }

    console.log(`Total matches found for ${leagueName} ${season}: ${matches.length}`);
    return matches;
  }

  private async goToNextPageAjax(currentPage: number, requestDetails: any): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      // First try to find the next button and get its ID
      const nextButton = await this.page.$('a.next');
      if (!nextButton) {
        console.log('No next button found');
        return false;
      }

      const buttonId = await this.page.evaluate(btn => btn.id, nextButton);
      console.log('Next button ID:', buttonId);

      // Execute the JavaScript that the site normally would
      const result = await this.page.evaluate((btnId) => {
        // @ts-ignore - we know these functions exist on the page
        if (typeof page_competition_1_block_competition_matches_10_update === 'function') {
          // This is the function that the site uses to update the content
          // @ts-ignore
          page_competition_1_block_competition_matches_10_update(btnId);
          return true;
        }
        return false;
      }, buttonId);

      if (result) {
        console.log('Successfully triggered pagination update');
        // Wait for content to update
        await this.page.waitForFunction(
          () => document.querySelector('td.score-time'),
          { timeout: 5000 }
        );
        return true;
      }

      console.log('Could not trigger pagination update, falling back to direct request');
      return false;
    } catch (error) {
      console.error('Error during AJAX pagination:', error);
      return false;
    }
  }

  private async randomDelay(): Promise<void> {
    const delay = Math.floor(
      Math.random() * (SCRAPER_CONFIG.maxDelay - SCRAPER_CONFIG.minDelay) + 
      SCRAPER_CONFIG.minDelay
    );
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async saveMatches(
    leagueName: string,
    season: string,
    matches: MatchData[]
  ): Promise<void> {
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });
    
    const filename = `${leagueName}-${season}.json`;
    await fs.writeFile(
      path.join(outputDir, filename),
      JSON.stringify(matches, null, 2)
    );
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
} 