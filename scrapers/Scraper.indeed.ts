import { Listing } from './Listing';
import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class IndeedScraper extends Scraper {
  constructor() {
    super({ name: 'indeed', url: 'https://www.indeed.com/jobs?q=computer%20science%20internship&l=Honolulu%2C%20HI&vjk=4d4385fce8630e4b' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async login() {
    await super.login();
    // if you need to login, put that code here.
  }

  async generateListings() {
    await super.generateListings();
    let pageNum = 1;
    const listingsTable = '#mosaic-zone-jobcards';

    // pageUrl returns an URL containing the specified page number.
    const pageUrl = (pageNum) =>
      `https://www.indeed.com/jobs?q=computer%20science%20internship&l=Honolulu%2C%20HI&vjk=4d4385fce8630e4b&page=${pageNum}`;

    // Get the first page of Internship listings.
    await super.goto(pageUrl(pageNum));

    while (await super.selectorExists(listingsTable)) {
      // Collect the URLs to the listings on this page.
      let urls = await super.getValues('div[class="jobsearch-SerpJobCard unifiedRow row result clickcard"] h2.title a', 'href');
      this.log.info(`Processing page ${pageNum} with ${urls.length} listings.`);
      // Retrieve each URL, extract the internship listing info.
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        await this.page.goto(url);
        const company = 'Apple';
        const position = (await super.getValues('div.jobsearch-JobInfoHeader-title-container', 'innerText'))[0];
        const description = (await super.getValues('div[class="jobsearch-jobDescriptionText"]', 'innerText'))[0];
        // const state = await super.getValues('span[itemprop="addressRegion"]', 'innerText');
        // const city = await super.getValues('span[itemprop="addressLocality"]', 'innerText');
        const location = (await super.getValues('div[class="jobsearch-InlineCompanyRating icl-u-xs-mt--xs jobsearch-DesktopStickyContainer-companyrating"] +'
          + ' div', 'innerText'))[0];
        const listing = new Listing({ url, position, location, company, description });
        this.listings.addListing(listing);
      }

      // Increment the pageNum and get that page. If we get a page without listings, then listingsTable selector won't be on it.
      await this.page.goto(pageUrl(++pageNum), { waitUntil: 'networkidle0' });
    }


  }

  async processListings() {
    await super.processListings();
    // here is where you do any additional processing on the raw data now available in the this.listings field.
  }

}
