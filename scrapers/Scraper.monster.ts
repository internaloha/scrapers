import { Listing } from './Listing';
import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class MonsterScraper extends Scraper {
  constructor() {
    super({ name: 'monster', url: 'https://www.monster.com/jobs/search?q=computer+science+intern&where=united+states' });
  }
  
  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async generateListings() {
    await super.generateListings();
    await this.page.goto(this.url);

    let urls = [];
    let positions = [];
    let companies = [];

    const nextLink = 'div[class="job-search-resultsstyle__LoadMoreContainer-sc-1wpt60k-1 eDBmDW"]';
    const nextPage = 'a[class="sc-dkPtyc hVjBwZ  ds-button"]';
    const urlSelector = 'a[class="job-cardstyle__JobCardComponent-sc-1mbmxes-0 khzaNc"]';
    const positionSelector = 'div[class="job-cardstyle__JobCardTitle-sc-1mbmxes-2 fsDALQ"]';
    const companySelector = 'h3[class="job-cardstyle__JobCardCompany-sc-1mbmxes-3 cYIFfT"]';
    //retrieve the url of the position
    await super.autoScroll();
    urls = urls.concat(await super.getValues(urlSelector, 'href'));
    // get the name of the posiiton
    positions = await super.getValues(positionSelector, 'innerText');
    this.log.debug(`Positions: \n${positions}`);
    // get the name of the companies
    companies = await super.getValues(companySelector, 'innerText');
    this.log.debug(`Companies: \n${companies}`);

    //while next link exists
    while (await super.selectorExists(nextLink)) {
      await this.page.click(nextPage);
      await super.autoScroll();
      urls = urls.concat(await super.getValues(urlSelector, 'href'));
      // get the name of the posiiton
      positions = await super.getValues(positionSelector, 'innerText');
      this.log.debug(`Positions: \n${positions}`);
      // get the name of the companies
      companies = await super.getValues(companySelector, 'innerText');
      this.log.debug(`Companies: \n${companies}`);

    }
    this.log.debug(`Found ${urls.length} URLs: \n${urls}`);
    // Retrieve each URL, extract the internship listing info.
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      // go to the page of the url of that listing
      await this.page.goto(url);
      // retrieve the description from that page
      const description = await super.getValue('div[class="descriptionstyles__DescriptionBody-sc-13ve12b-4 eCiZzS"]', 'innerText');
      const jobLocation = await super.getValues('div[class="detailsstyles__DetailsTableDetailBody-sc-1deoovj-5 gPiXKx"]', 'innerText');
      const loc = jobLocation.toString().split(',');
      const location = { city: loc[0], state: loc[1], country: 'United States' };
      // create the listing information
      const listing = new Listing({ url: urls[i], position: positions[i], location, company: companies[i], description: description });
      this.listings.addListing(listing);
    }
  }
}
