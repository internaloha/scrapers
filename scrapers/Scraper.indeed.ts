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

  async generateListings() {
    await super.generateListings();
    let pageNum = 1;
    //const listingsTable = '#mosaic-zone-jobcards';

    // pageUrl returns an URL containing the specified page number.
    const pageUrl = (pageNum) =>
      `https://www.indeed.com/jobs?q=computer%20science%20internship&l=Honolulu%2C%20HI&vjk=4d4385fce8630e4b&page=${pageNum}`;

    // Get the first page of Internship listings.
    await super.goto(pageUrl(pageNum));

    //select the boxes and there links
    await this.page.waitForSelector(('div[class="mosaic-zone"] > div[class="mosaic mosaic-provider-jobcards mosaic-provider-hydrated"] > a'));
    // saves links to url
    let urls = (await super.getValues('div[class="mosaic-zone"] > div[class="mosaic mosaic-provider-jobcards mosaic-provider-hydrated"] > a', 'href'));

    this.log.debug(`URLS: ${urls}`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      await this.page.goto(url);
      const company = await super.getValue('div[class="jobsearch-InlineCompanyRating icl-u-xs-mt--xs jobsearch-DesktopStickyContainer-companyrating"] > div[class="icl-u-lg-mr--sm icl-u-xs-mr--xs"]', 'innerText');
      const position = await super.getValue('h1[class="icl-u-xs-mb--xs icl-u-xs-mt--none jobsearch-JobInfoHeader-title"]', 'innerText');
      const description = await super.getValue('div[class="jobsearch-JobComponent-description icl-u-xs-mt--md"]', 'innerText');
      const location = { state: 'Hawaii', city: 'Honolulu', country: '' };
      const listing = new Listing({ url, position, location, company, description });
      this.listings.addListing(listing);
    }

  }


  async processListings() {
    await super.processListings();
    // here is where you do any additional processing on the raw data now available in the this.listings field.
  }

}
