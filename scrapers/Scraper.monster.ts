import { Listing } from './Listing';
import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class MonsterScraper extends Scraper {
  constructor() {
    super({ name: 'monster', url: 'https://www.monster.com/jobs/search?q=computer+science+intern&where=united+states' });
  }

  async autoScrollToBottom() {
    const endPage = document.querySelector('div.sc-fTQuIj fxTeMH');
    while (endPage.clientHeight === 0) {
      window.scrollBy(0, document.scrollingElement.scrollHeight);
      await new Promise((resolve) => { setTimeout(resolve, 1000); });
    }
    return document.querySelectorAll('a.job-cardstyle__JobCardComponent-sc-1mbmxes-0 khzaNc').length;
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async login() {
    await super.login();
    await super.goto(this.url);
  }

  async generateListings() {
    await super.generateListings();
    await super.goto('https://www.monster.com/jobs/search?q=computer+science+intern&where=united+states');
    await this.page.waitForNavigation;
    //retrieve the url of the position
    let urls = await super.getValues('a[class="job-cardstyle__JobCardComponent-sc-1mbmxes-0 khzaNc"]', 'href');
    // get the name of the posiiton
    const positions = await super.getValues('div[class="job-cardstyle__JobCardTitle-sc-1mbmxes-2 fsDALQ"]', 'innerText');
    this.log.debug(`Positions: \n${positions}`);
    // get the name of the companies
    const companies = await super.getValues('h3[class="job-cardstyle__JobCardCompany-sc-1mbmxes-3 cYIFfT"', 'innerText');
    this.log.debug(`Companies: \n${companies}`);
    // get the name of the location
    const locations = await super.getValues('p[class="job-cardstyle__JobCardCompany-sc-1mbmxes-5 cYIFfT"]', 'innerText');
    this.log.debug(`Locations: \n${locations}`);

    //break the cities and states of the locations
    const cities = [];
    const states = [];
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i].split(', ');
      cities.push(loc[0]);
      states.push(loc[1]);
    }

    // Retrieve each URL, extract the internship listing info.
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      // go to the page of the url of that listing
      await this.page.goto(url);
      // retrieve the description from that page
      const description = await super.getValues('div[class="descriptionstyles__DescriptionBody-sc-13ve12b-4 eCiZzS"]', 'innerText');
      const location = { city: cities[i], state: states[i], country: 'United States' };
      // create the listing information
      const listing = new Listing({ url: urls[i], position: positions[i], location, company: companies[i], description: description });
      this.listings.addListing(listing);
    }
  }

  async processListings() {
    await super.processListings();
  }

}
