// Example CLI application entry point
import { Command } from "commander";
import { ExecutionContext, Job, JobExecutor } from './tsbatch';
import { LEAGUES } from './config';
import { MatchScraperStep } from './steps/match-scraper.step';
import { LeagueConfig, MatchData } from './types';
import { connect } from "http2";


// class SoccerScraperJob extends Job<LeagueConfig, MatchData[]> {
//   constructor() {
//     super();
//     this.addStep(new MatchScraperStep());
//   }
// }

class SoccerScraperJob extends Job {
  constructor() {
    super('SoccerScraperJob');
    this.addStep(new MatchScraperStep());
  }
}

const program = new Command();

program
  .name('soccer-scraper')
  .description('CLI tool to scrape soccer match data from Soccerway')
  .version('1.0.0');

program
  .command('scrape')
  .description('Scrape match data for configured leagues and seasons')
  .option('-l, --league <name>', 'Specific league to scrape')
  .action(async (options) => {
    try {
      const executor = new JobExecutor();

      let leaguesToScrape = LEAGUES;
      if (options.league) {
        leaguesToScrape = LEAGUES.filter(l => l.name === options.league);
        if (leaguesToScrape.length === 0) {
          console.error(`League "${options.league}" not found`);
          process.exit(1);
        }
      }

      for (const league of leaguesToScrape) {
        const context = new ExecutionContext();
        context.set('matches', []);
        context.set('league', league);

        console.log(`Scraping ${league.name}...`);
        const job = new SoccerScraperJob();
        await executor.addJob(job, context);
        console.log(`Finished scraping ${league.name}`);
      }

      await executor.executeSequentially();

      console.log('Scraping completed successfully');
    } catch (error) {
      console.error('Error during scraping:', error);
      process.exit(1);
    }
  });

program.parse();
