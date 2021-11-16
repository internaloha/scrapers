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

    //go to the indeed website
    await super.goto('https://www.indeed.com/jobs?q=computer%20science%20internship&l=Honolulu%2C%20HI&vjk=4d4385fce8630e4b&page=1');

    //select the boxes and their links
    await this.page.waitForSelector(('div[class="mosaic-zone"] > div[class="mosaic mosaic-provider-jobcards mosaic-provider-hydrated"] > a'));

    // saves links to url array
    let urls = (await super.getValues('div[class="mosaic-zone"] > div[class="mosaic mosaic-provider-jobcards mosaic-provider-hydrated"] > a', 'href'));

    this.log.debug(`URLS: ${urls}`);

    //Loop through urls
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      //We want to make sure that we complete going the new page, before we start adding the listing
      await Promise.all([
        await super.goto(url),
        this.page.waitForNavigation(),
      ]);

      const company = await super.getValue('div[class="jobsearch-InlineCompanyRating icl-u-xs-mt--xs jobsearch-DesktopStickyContainer-companyrating"] > div[class="icl-u-lg-mr--sm icl-u-xs-mr--xs"]', 'innerText');
      const position = await super.getValue('h1[class="icl-u-xs-mb--xs icl-u-xs-mt--none jobsearch-JobInfoHeader-title"]', 'innerText');
      const description = await super.getValue('div[class="jobsearch-JobComponent-description icl-u-xs-mt--md"]', 'innerText'); //might want to filter description
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
