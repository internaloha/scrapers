import { Listing } from './Listing';
import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class StackOverFlowScrapper extends Scraper {
  constructor() {
    super({ name: 'stackoverflow', url: 'https://stackoverflow.com/jobs?q=internship&l=United+States&d=100&u=Km' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async generateListings() {
    await super.generateListings();
    // go to their page
    await this.page.goto(this.url);
    // extract the number of internships currently available
    const key = await super.getValue('span[class="description fc-light fs-body1"]', 'innerText');
    // store it called jobNumber
    const jobNumber = key.match(/\d+/gm);
    this.log.debug(`Amount of internships available: \n${jobNumber[0]}`);
    // extract the urls on the page
    let urls = await super.getValues('a[class="s-link stretched-link"]', 'href');
    // for each url such that is within the jobCount
    for (let i = 0; i < jobNumber ; i++) {
      let url = urls[i];
      this.log.debug(`Processing: ${url}`);
      await this.page.goto(url);
      // extract the position, company, description
      let position = await super.getValue('h1[class="fs-headline1 sticky:fs-body3 sticky:sm:fs-subheading t mb4 sticky:mb2"]', 'innerText');
      let company = await super.getValue('div[class="fc-black-700 mb4 sticky:mb0 sticky:mr8 fs-body2 sticky:fs-body1 sticky:sm:fs-caption"]', 'innerText');
      let description = await super.getValue('section[class="mb32 fs-body2 fc-medium"]', 'innerText');
      let jobLocation = await super.getValue('span[class="fc-black-500"]', 'innerText');
      let city ='';
      let state = '';
      if (jobLocation !== null) {
        const locationTuple = jobLocation.split(', ');
        city = locationTuple[0];
        state = locationTuple[1];
      } else {
        state = 'remote';
      }

      const location = { city: city, state: state, country: 'United States' };

      const listing = new Listing({ url: url, position: position, location, company: company, description: description });
      this.listings.addListing(listing);
    }
  }
}
