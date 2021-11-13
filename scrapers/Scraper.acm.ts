import { Scraper } from './Scraper';
import { Listing } from './Listing';

const prefix = require('loglevel-plugin-prefix');

/**
 * Converts posted strings to ISO format. This is ONLY if it follows the format of:
 * Posted: 4 days ago... 3 weeks ago... a month ago
 * @param posted The string
 * @returns {Date}
 */
function convertPostedToDate(posted) {
  const date = new Date();
  let daysBack: number;
  if (posted.includes('hours') || (posted.includes('hour')) || (posted.includes('minute'))
    || (posted.includes('minutes')) || (posted.includes('moment')) || (posted.includes('second'))
    || (posted.includes('seconds')) || (posted.includes('today'))) {
    daysBack = 0;
  } else if ((posted.includes('week')) || (posted.includes('weeks'))) {
    daysBack = posted.match(/\d+/g) * 7;
  } else if ((posted.includes('month')) || (posted.includes('months'))) {
    daysBack = posted.match(/\d+/g) * 30;
  } else {
    daysBack = posted.match(/\d+/g);
  }
  date.setDate(date.getDate() - daysBack);
  return date;
}

export class AcmScraper extends Scraper {
  private searchTerms: string;
  private urls: string[];

  constructor() {
    super({ name: 'acm', url: 'https://jobs.acm.org' });
    this.urls = [];
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
    this.log.debug(`Discipline: ${this.discipline}`);
    // check the config file to set the search terms.
    // this.searchTerms = this.config?.additionalParams?.acm?.searchTerms[this.discipline] || 'intern';
    this.searchTerms = super.getNested(this.config, 'additionalParams', 'acm', 'searchTerms', this.discipline) || 'internship';
    this.log.debug(`Search Terms: ${this.searchTerms}`);
  }

  async login() {
    await super.login();
    const searchUrl = `https://jobs.acm.org/jobs/?keywords=${this.searchTerms}&pos_flt=0&location=United+States&location_completion=city=$state=$country=United+States&location_type=country&location_text=United+States&location_autocomplete=true`;
    this.log.debug(`Going to ${searchUrl}`);
    await super.goto(searchUrl);
  }

  /**
   * Process the left-hand set of tiles to get the detail URL for internships. Then go to the next page of tiles.
   */
  async getInternshipUrls() {
    await this.page.waitForSelector('.job-result-tiles .job-tile');
    let isInactive;
    let pageNumber = 1;
    do {
      this.log.debug(`Getting Urls on page ${pageNumber}`);
      const nextPageElement = await this.page.$('ul[class="pagination"] li:nth-child(6)[class="page-item inactive"]');
      isInactive = nextPageElement !== null;
      const pageUrls = await super.getValues('.job-result-tiles .job-tile .job-main-data .job-details .job-detail-row .job-title a', 'href');
      pageUrls.forEach(url => {
        if (url.toLowerCase().includes('intern')) {
          this.urls.push(url);
        }
      });
      const nextPageEl = await this.page.$('ul[class="pagination"] li:nth-child(6)');
      pageNumber++;
      await Promise.all([
        nextPageEl.click(),
        // this.page.waitForSelector('.job-result-tiles .job-tile'),
        super.randomWait(),
      ]);
      this.log.debug(`Now have ${this.urls.length} internships isInactive = ${isInactive}`);
    } while (!isInactive);
  }

  /**
   * Process the detail pages to create listings.
   */
  async processUrls() {
    let url;
    for (let i = 0; i < this.urls.length; i++) {
      url = this.urls[i];
      await super.goto(url);
      const position = await super.getValue('.job-main-data .job-details .job-detail-row h1.job-title', 'innerText');
      const company = await super.getValue('.job-company-row', 'innerText');
      const locStr = await super.getValue('.company-location', 'innerText');
      // TODO should this code be consolidated somewhere?
      const lSplit = locStr.split(',');
      const city = (lSplit.length > 0) ? lSplit[0] : '';
      const state = (lSplit.length > 1) ? lSplit[1] : '';
      const country = (lSplit.length > 2) ? lSplit[2] : '';
      this.log.debug(`Location: {${city}, ${state}, ${country}}`);
      const location = { city, state, country };
      const postedStr = await super.getValue('.job-posted-date', 'innerText');
      const posted = convertPostedToDate(postedStr.toLowerCase()).toLocaleDateString();
      const description = await super.getValue('.job-main-desc .job-desc', 'innerHTML');
      const listing = new Listing({ url, location, position, description, company, posted });
      this.listings.addListing(listing);
    }
  }

  async generateListings() {
    await super.generateListings();
    // get all the internship urls
    await this.getInternshipUrls();
    this.log.debug(this.urls);
    await this.processUrls();
  }

  async processListings() {
    await super.processListings();
    // No post-processing (yet) for ACM scraper results.
  }
}
