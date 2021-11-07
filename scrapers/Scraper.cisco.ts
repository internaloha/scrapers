import { Scraper } from './Scraper';
import { Listing } from './Listing';

const prefix = require('loglevel-plugin-prefix');

export class CiscoScraper extends Scraper {
  constructor() {
    super({ name: 'cisco', url: 'https://jobs.cisco.com/jobs/SearchJobs/?21178=%5B169482%5D&21178_format=6020&21180=%5B165%5D&21180_format=6022&21181=%5B186%2C194%2C201%2C187%2C191%2C196%2C197%2C67822237%2C185%2C55816092%5D&21181_format=6023&listFilterMode=1' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async generateListings() {
    await super.generateListings();
    await this.page.goto(this.url);

    const nextLink = 'div[class="pagination autoClearer"] a:last-child';
    const urlSelector = 'table[class="table_basic-1 table_striped"] tbody tr td[data-th="Job Title"] a';
    let urls = [];
    urls = urls.concat(await super.getValues(urlSelector, 'href'));
    while (await super.selectorExists(nextLink)) {
      await this.page.click(nextLink);
      urls = urls.concat(await super.getValues(urlSelector, 'href'));
    }
    this.log.debug(`Found ${urls.length} URLS: \n${urls}`);
    const descriptions = [];
    const positions = [];
    const cities = [];
    const states = [];
    for (const url of urls) {
      this.log.debug(`Processing: ${url}`);
      await this.page.goto(url);
      positions.push((await super.getValues('h2[itemprop="title"]', 'innerText'))[0]);
      descriptions.push(await super.getValues('div[itemprop="description"]', 'innerText'));
      const location = (await super.getValues('div[itemprop="jobLocation"]', 'innerText'))[0];
      const locationTuple = location.split(', ');
      cities.push(locationTuple[0]);
      states.push(locationTuple[1]);
    }

    // Now we add listings. All arrays are (hopefully!) the same length.
    for (let i = 0; i < urls.length; i++) {
      const location = { city: cities[i], state: states[i], country: '' };
      const listing = new Listing({ url: urls[i], position: positions[i], location, company: 'Cisco', description: descriptions[i] });
      this.listings.addListing(listing);
    }
  }

  async processListings() {
    await super.processListings();
    // Not yet implemented.
  }
}
