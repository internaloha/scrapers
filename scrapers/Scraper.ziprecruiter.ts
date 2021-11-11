import { Listing } from './Listing';
import { Scraper } from './Scraper';
import _ from 'underscore';

const prefix = require('loglevel-plugin-prefix');

export class ZipRecruiterScraper extends Scraper {
  constructor() {
    super({ name: 'ziprecruiter', url: 'https://www.ziprecruiter.com/candidate/search?search=computer+science+internship&location=United+States&days=30&radius=25' });
  }

  /** Scrolls down 400 pixels every 400 milliseconds until scrolling doesn't increase the page size. */
  async autoScroll() {
    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve(); //????
          }
        }, 400);
      });
    });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async generateListings() {
    super.generateListings();
    await this.page.goto(this.url);
    await this.page.goto(this.url); // interestingly, we must request the page twice. Maybe to get past popup?

    await this.page.click('.load_more_jobs');
    await this.autoScroll();

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

    // Retrieve each URL, extract the internship listing info.
    for (let i = 0; i < urls.length; i++) {
      const listing = new Listing({ url: urls[i], position: positions[i], location: locations[i], company: companies[i], description: descriptions[i] });
      this.listings.addListing(listing);
    }
  }
}
