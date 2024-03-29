import { Scraper } from './Scraper';
import { Listing } from './Listing';

const prefix = require('loglevel-plugin-prefix');

export class SimplyHiredScraper extends Scraper {
  private searchTerms: string;

  private baseURL: string;

  constructor() {
    super({ name: 'simplyhired', url: 'https://www.simplyhired.com' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
    this.log.debug(`Discipline: ${this.discipline}`);
    // check the config file to set the search terms.
    this.searchTerms = super.getNested(this.config, 'additionalParams', 'simplyHired', 'searchTerms', this.discipline) || 'computer science intern';
    this.log.debug(`Search Terms: ${this.searchTerms}`);
  }

  async login() {
    await super.login();
    this.log.debug(`Going to ${this.url}`);
    await super.goto(this.url);
  }

  async setUpSearchCriteria() {
    this.log.debug('Setting up search criteria');
    await this.page.waitForSelector('input[name=q]');
    await this.page.$eval('input[name=l]', (el) => {
      // eslint-disable-next-line no-param-reassign
      el.value = '';
    }, {});
    await this.page.type('input[name=q]', this.searchTerms);
    await Promise.all([
      this.page.click('button[type="submit"]'),
      this.page.waitForNavigation()
    ]);
    this.log.debug(`Inputted search query: ${this.searchTerms}`);
    await this.page.waitForSelector('div[data-id=JobType]');
    // Getting href link for internship filter
    const internshipDropdown = await super.getValue('a[href*="internship"]', 'href');
    if (internshipDropdown) {
      const url = internshipDropdown;
      this.log.debug(`Directing to: ${url}`);
      await super.goto(url);
      // Setting filter as last '30 days'
      const lastPosted = await super.getValue('div[data-id=Date] a[href*="30"]', 'href');
      this.log.debug('Setting Date Relevance: 30 days');
      this.log.debug(`Directing to: ${lastPosted}`);
      await super.goto(lastPosted);
      this.baseURL = lastPosted;
      await Promise.all([
        this.page.click('a[class=SortToggle]'),
        this.page.waitForNavigation()
      ]);
      // Filtering by most recent
      this.log.debug('Filtering by: Most recent');
    } else {
      this.log.warn(`There are no internships with the search query: \'${this.searchTerms}\'`);
    }
  }

  async processPage(pageNumber) {
    let internshipsPerPage = 0;
    const urls = await super.getValues('a[class="SerpJob-link card-link"]', 'href');
    this.log.debug('Processing page', (pageNumber + 1), ': ', urls.length, ' internships');
    // await super.randomWait();
    for (let i = 0; i < urls.length; i++) {
      // await super.goto(urls[i]);
      await this.page.goto(urls[i], {waitUntil: 'networkidle0'});
      const positionVal = await super.getValue('div[class="viewjob-jobTitle h2"]', 'innerText');
      const position = positionVal.trim();
      const companyVal = await super.getValue('div[class="viewjob-header-companyInfo"] div:nth-child(1)', 'innerText');
      let company;
      company = companyVal;
      // strip off the rating for the company
      const ratingIndex = company.lastIndexOf('-');
      if (ratingIndex !== -1) {
        company = company.substring(0, ratingIndex).trim();
      }
      const locationObj = await super.getValues('div[class="viewjob-header-companyInfo"] div:nth-child(2)', 'innerText');
      if (locationObj.length > 1) {
        this.log.debug(`Multiple locations for ${company}: ${position}`);
      }
      const locationStr = `${locationObj}`;
      const description = await super.getValue('div[class="viewjob-jobDescription"]', 'innerHTML');
      let posted = '';
      if (await super.selectorExists('span[class="viewjob-labelWithIcon viewjob-age"]')) {
        const postedVal = await super.getValue('span[class="viewjob-labelWithIcon viewjob-age"]', 'innerText');
        posted = this.convertPostedToDate(postedVal.toLowerCase()).toLocaleDateString();
      } else {
        posted = 'N/A';
        this.log.trace('No date found. Setting posted as: N/A');
      }
      this.log.debug(`Position: ${position}`);
      this.log.debug(`Company: ${company}`);
      this.log.debug(`Posted: ${posted}`);
      const url = urls[i];
      const lSplit = locationStr.split(', ');
      const city = (lSplit.length > 0) ? lSplit[0] : '';
      const state = (lSplit.length > 1) ? lSplit[1] : '';
      const country = (lSplit.length > 2) ? lSplit[2] : '';
      this.log.debug(`Location: {${city}, ${state}, ${country}}`);
      const location = { city, state, country };
      const listing = new Listing({ url, location, position, description, company, posted });
      this.listings.addListing(listing);
      internshipsPerPage++;
    }
    return internshipsPerPage;
  }

  async generateListings() {
    await super.generateListings();
    await this.setUpSearchCriteria();
    let totalPages = 0;
    let totalInternships = 0;
    let hasNext = true;
    do {
      totalInternships += await this.processPage(++totalPages);
      await super.goto(`${this.baseURL}&pn=${totalPages}`);
      const nextPage = await this.page.$('a[class="Pagination-link next-pagination"]');
      if (!nextPage) {
        hasNext = false;
        this.log.info('Reached the end of pages!');
      } else {
        const nextPageUrl = `${this.baseURL}&pn=${totalPages + 1}`;
        await super.goto(nextPageUrl);
        const message = `Processed page ${totalPages}, ${totalInternships} total internships`;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        ((totalPages === 1) || (totalPages % 10 === 0)) ? this.log.info(message) : this.log.debug(message);
      }
    } while (hasNext);
    this.log.debug(`Found ${totalPages} pages.`);
  }
}
