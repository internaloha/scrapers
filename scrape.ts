import * as fs from 'fs';
import { Command, Option } from 'commander';
import { DISCIPLINES } from './disciplines';
import { AngelListScraper } from './scrapers/Scraper.angellist';
import { AppleScraper } from './scrapers/Scraper.apple';
import { CheggScraper } from './scrapers/Scraper.chegg';
import { CiscoScraper } from './scrapers/Scraper.cisco';
import { GlassDoorScraper } from './scrapers/Scraper.glassdoor';
import { LinkedinScraper } from './scrapers/Scraper.linkedin';
import { MonsterScraper } from './scrapers/Scraper.monster';
import { NsfScraper } from './scrapers/Scraper.nsf';
import { SimplyHiredScraper } from './scrapers/Scraper.simplyHired';
import { StackOverFlowScrapper } from './scrapers/Scraper.stackoverflow';
import { TestScraper } from './scrapers/Scraper.test';
import { ZipRecruiterScraper } from './scrapers/Scraper.ziprecruiter';
import { IndeedScraper } from './scrapers/Scraper.indeed';

/**
 *  Create all possible scraper instances next. Keys must be all lower case.
 *  When adding a new scraper to the system, you should only need to import it above
 *  and add it to the scrapers object below.
 *
 *  We make default instances of all scrapers before processing command line arguments in order to tell
 *  the CLI what the set of legal scraper names are.
 *
 *  After we process the CLI args, we then configure the selected scraper from the CLI values before execution.
 */
const scrapers = {
  angellist: new AngelListScraper(),
  apple: new AppleScraper(),
  chegg: new CheggScraper(),
  cisco: new CiscoScraper(),
  linkedin: new LinkedinScraper(),
  monster: new MonsterScraper(),
  nsf: new NsfScraper(),
  simplyhired: new SimplyHiredScraper(),
  test: new TestScraper(),
  ziprecruiter: new ZipRecruiterScraper(),
  glassdoor: new GlassDoorScraper(),
  stackoverflow: new StackOverFlowScrapper(),
  indeed: new IndeedScraper(),
};

// You don't normally edit anything below.

/* Create an array of scraper names to be used by the CLI. */
const scraperNames = Object.values(scrapers).map(scraper => scraper.getName().toLowerCase());

// Process the command line arguments. A legal scraper name is required.
const program = new Command()
  .addOption(new Option('-s, --scraper <scraper>', 'Specify the scraper.')
    .choices(scraperNames)
    .makeOptionMandatory(true))
  .addOption(new Option('-l, --log-level <level>', 'Specify logging level')
    .default('info')
    .choices(['trace', 'debug', 'info', 'warn', 'error']))
  .addOption(new Option('-d, --discipline <discipline>', 'Specify what types of internships to find')
    .default(DISCIPLINES.CompSci)
    .choices(Object.values(DISCIPLINES)))
  .addOption(new Option('-c, --config-file <config-file>', 'Specify config file name.')
    .default('config.json'))
  .option('-nh, --no-headless', 'Disable headless operation (display browser window during execution)')
  .option('-dt, --devtools', 'Open a devtools window during run.', false)
  .option('-cf, --commit-files', 'Write listing and statistic files that are not git-ignored.', false)
  .option('-sm, --slowMo <milliseconds>', 'Pause each puppeteer action by the provided number of milliseconds.', '0')
  .option('-t,  --default-timeout <seconds>', 'Set default timeout in seconds for puppeteer.', '0')
  .option('-ld, --listing-dir <listingdir>', 'Set the directory to hold listing files.', './listings')
  .option('-ml, --minimum-listings <minlistings>', 'Throw error if this number of listings not found.', '0')
  .option('-sd, --statistics-dir <statisticsdir>', 'Set the directory to hold statistics files.', './statistics')
  .option('-vph, --viewport-height <height>', 'Set the viewport height (when browser displayed).', '700')
  .option('-vpw, --viewport-width <width>', 'Set the viewport width (when browser displayed).', '1000')
  .option('-plf, --process-listings-file <listingsFile>', 'Initialize scraper with listings, then run processListings and write results')
  .parse(process.argv);
const options = program.opts();

// Uncomment the following line to verify the CLI option values.
// console.log('cli options:', options);

// Now process the command line args.
const configFile = options.configFile;
let config;
try {
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} catch (Exception) {
  console.log(`${configFile} missing or unable to be parsed. Exiting without running scrapers.`);
  process.exit(0);
}

/* Set the runtime options for the selected scraper. */
const scraper = scrapers[options.scraper.toLowerCase()];
scraper.config = config;
scraper.commitFiles = !!options['commitFiles'];
scraper.defaultTimeout = parseInt(options.defaultTimeout, 10) * 1000;
scraper.devtools = options.devtools;
scraper.discipline = options.discipline;
scraper.headless = options.headless;
scraper.listingDir = options.listingDir;
scraper.log.setLevel(options.logLevel);
scraper.minimumListings = parseInt(options.minimumListings, 10);
scraper.slowMo = parseInt(options.slowMo, 10);
scraper.statisticsDir = options.statisticsDir;
scraper.viewportHeight = parseInt(options.viewportHeight, 10);
scraper.viewportWidth = parseInt(options.viewportWidth, 10);

// Uncomment the following line to verify the scraper state prior to running.
//Object.keys(scraper).map(key => console.log(`${key}: ${scraper[key]}`));

/* Run the chosen scraper, either from the passed listings file or from scratch.. */
if (options.processListingsFile) {
  scraper.initializeAndProcessListings(options.processListingsFile);
} else {
  scraper.scrape();
}
