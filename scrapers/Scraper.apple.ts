import { Listing } from './Listing';
import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class Apple extends Scraper {
  constructor() {
    super({ name: 'apple' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async generateListings() {
    await super.generateListings();
    let pageNum = 1;
    const listingsTable = '#tblResultSet';

    // pageUrl returns an URL containing the specified page number.
    const pageUrl = (pageNum) =>
      `https://jobs.apple.com/en-us/search?location=united-states-USA&sort=relevance&search=internship&page=${pageNum}`;

    // Get the first page of Internship listings.
    await this.page.goto(pageUrl(pageNum), { waitUntil: 'networkidle0' });

    while (await super.selectorExists(listingsTable)) {
      // Collect the URLs to the listings on this page.
      let urls = await super.getValues('a[class="table--advanced-search__title"]', 'href');
      this.log.info(`Processing page ${pageNum} with ${urls.length} listings.`);
      // Retrieve each URL, extract the internship listing info.
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        await this.page.goto(url);
        const company = 'Apple';
        const position = await super.getValue('h1[itemprop="title"]', 'innerText');
        const description = await super.getValue('div[id="jd-description"]', 'innerText');
        const state = await super.getValue('span[itemprop="addressRegion"]', 'innerText');
        const city = await super.getValue('span[itemprop="addressLocality"]', 'innerText');
        const location = { city, state, country: 'USA' };
        const listing = new Listing({ url, position, location, company, description });
        this.listings.addListing(listing);
      }
      // Increment the pageNum and get that page. If we get a page without listings, then listingsTable selector won't be on it.
      await this.page.goto(pageUrl(++pageNum), { waitUntil: 'networkidle0' });
    }
  }
}
