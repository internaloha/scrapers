import { Scraper } from './Scraper';
import { Listing } from './Listing';

const prefix = require('loglevel-plugin-prefix');

export class AexpressScraper extends Scraper {
  constructor() {
    super({ name: 'Aexpress', url: 'https://aexp.eightfold.ai/careers?location=United%20States&query=Campus' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async getDescription() {
    const results = [];
    results.push(await super.getValue('h1[class="position-title"]', 'innerText'));
    results.push(await super.getValue('p[class="position-location"]', 'innerText'));
    results.push(await super.getValues('div[class="position-job-description"]', 'innerHTML'));
    return results;
  }

  async getData() {
    try {
      // Scrapes internships one by one (do not scroll during this process or the scraper will stop)
      await this.page.waitForTimeout(5000);
      const totalJobs = await super.getValue('div[class="personalization-bar personalization-bar-pre-upload"] > div > span > span > strong', 'innerText');
      this.log.info(totalJobs);
      const numberOfJobs = await totalJobs.match(/\d+/g);
      this.log.info(numberOfJobs);
      for (let i = 0; i < numberOfJobs[0]; i++) {
        await this.page.waitForTimeout(1000);
        const cardName = `div[data-test-id="position-card-${i}"]`;
        this.log.debug(`cardname: ${cardName}`);
        await this.page.waitForSelector(`div[data-test-id="position-card-${i}"]`);
        await this.page.click(cardName);
        const city = 'N/A';
        const state = 'Error';
        const company = 'American Express';
        const contact = 'https://careers.americanexpress.com/';
        const url = await this.page.url();
        const [position, location, description] = await this.getDescription();
        const listing =  new Listing({
          position: position,
          company: company,
          contact: contact,
          url: url,
          location: { city: city, state: state, country: location },
          description: description,
        });
        this.listings.addListing(listing);
      }
    } catch (e) {
      this.log.error(e);
    }
  }

  async setSearchFilters() {
    // Navigate to internship page
    await this.page.waitForSelector('input[id="main-search-box"]');
    await this.page.type('input[id="main-search-box"]', 'Internships');
    await this.page.waitForSelector('input[aria-label="Filter position by Location"]');
    await this.page.type('input[aria-label="Filter position by Location"]', 'USA');
    await this.page.keyboard.press('Enter');
  }

  async generateListings() {
    await super.generateListings();
    await this.page.goto(this.url);

    await this.setSearchFilters();
    await this.getData();

  }

}
