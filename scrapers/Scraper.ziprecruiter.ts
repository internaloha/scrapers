import { Listing } from './Listing';
import { Scraper } from './Scraper';
import _ from 'underscore';

const prefix = require('loglevel-plugin-prefix');

export class ZipRecruiterScraper extends Scraper {
  constructor() {
    super({ name: 'ziprecruiter', url: 'https://www.ziprecruiter.com/candidate/search?search=computer+science+internship&location=United+States&days=30&radius=25' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async generateListings() {
    super.generateListings();
    await this.page.goto(this.url);
    // interestingly, we must request the page again, otherwise only 20 listings. Maybe to get past popup?
    await this.page.goto(this.url);

    // Autoscroll to retrieve and display all of the listings on the page.
    await this.page.click('.load_more_jobs');
    await super.autoScroll400By400();

    let urls = await super.getValues('.job_link.t_job_link', 'href');
    urls = _.uniq(urls);
    this.log.info(`Found ${urls.length} listings`);

    const positions = await super.getValues('h1[class="job_title"]', 'innerText');
    const descriptions = await super.getValues('div[class="job_description_container"] ', 'innerText');
    const companies = await super.getValues('a[class="t_org_link name"]', 'innerText');

    const locationStrings = await super.getValues('a[class="t_location_link location"]', 'innerText');
    const locations = [];
    for (let i = 0; i < locationStrings.length; i++) {
      const locPair = locationStrings[i].split(', ');
      locations.push({ city: locPair[0], state: locPair[1], country: 'USA' })
    }

    for (let i = 0; i < urls.length; i++) {
      const listing = new Listing({ url: urls[i], position: positions[i], location: locations[i], company: companies[i], description: descriptions[i] });
      this.listings.addListing(listing);
    }
  }
}
