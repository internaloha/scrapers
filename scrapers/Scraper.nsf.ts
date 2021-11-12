import { Listing } from './Listing';
import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class NsfScraper extends Scraper {
  constructor() {
    super({ name: 'nsf', url: 'https://www.nsf.gov/crssprgm/reu/list_result.jsp?unitid=5049' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async generateListings() {
    super.generateListings();
    await super.goto(this.url);
    await this.page.waitForSelector('button[id="itemsperpage_top"]');
    await this.page.click('button[id="itemsperpage_top"]');
    await this.page.waitForSelector('a[onclick="showItemsPerPageForm(event, \'All\', \'?unitid=5049\')"]');
    await this.page.click('a[onclick="showItemsPerPageForm(event, \'All\', \'?unitid=5049\')"]');
    await this.page.waitForSelector('td[data-label="Site Information: "] > div > a');
    // Generate a set of parallel arrays containing the fields to be put into each listing.
    // Each array should be the same length, and each positional element should refer to the same listing.
    // Start by creating an array of URLs.
    let urls = await super.getValues('td[data-label="Site Information: "] > div > a', 'href');
    urls = urls.map(val => val.replace('https://www.nsf.gov/cgi-bin/good-bye?', ''));
    this.log.debug('URLS:', urls);

    // Positions
    const positions = await super.getValues('td[data-label="Site Information: "] > div > a', 'innerText');
    this.log.debug('Positions:', positions);

    // Descriptions
    const descriptions = await super.getValues('td[data-label="Additional Information: "] > div ', 'innerText');
    this.log.debug('Descriptions:', descriptions);

    // Companies
    const companies = await super.getValues('td[data-label="Site Information: "] > div > strong', 'innerText');
    this.log.debug('Companies:', companies);

    // Locations
    const locationStrings = await super.getValues('td[data-label="Site Location: "] > div', 'innerText');
    this.log.debug('Location Strings:', locationStrings);
    const locations = [];
    for (let i = 0; i < locationStrings.length; i++) {
      // Some location strings are city, state. Others are just the state.
      const locPair = locationStrings[i].split(', ');
      const city = (locPair.length === 2) ? locPair[0] : '';
      const state = (locPair.length === 1) ? locPair[0] : locPair[1];
      locations.push({ city, state, country: 'USA' });
    }

    // Now generate listings. All arrays are (hopefully!) the same length.
    for (let i = 0; i < urls.length; i++) {
      const listing = new Listing({ url: urls[i], position: positions[i], location: locations[i], company: companies[i], description: descriptions[i] });
      this.listings.addListing(listing);
    }
  }
}
