import { Listing } from './Listing';
import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class SOCScraper extends Scraper {
  constructor() {
    super({ name: 'soc', url: 'https://app.studentopportunitycenter.com/auth/login' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async login() {
    await super.login();
    let username;
    let password;
    try {
      username = this.config['credentials']['studentOpportunityCenter']['user'];
      password = this.config['credentials']['studentOpportunityCenter']['password'];
    } catch (error) {
      throw new Error('Could not find studentOpportunityCenter credentials in config file!');
    }
    await this.page.goto(this.url, { waitUntil: 'load', timeout: 0 });
    await this.page.waitForSelector('input[id=mat-input-0]');
    await this.page.type('input[id=mat-input-0]', username);
    await this.page.type('input[id=mat-input-1]', password);
    await Promise.all([
      this.page.click('#login-submit-button'),
      this.page.waitForNavigation()
    ]);
  }

  async setSearch() {
    // type in Computer Science Internship to the search field
    await this.page.waitForSelector('input[id="mat-input-3"]');
    await this.page.click('input[id="mat-input-3"]');
    await this.page.keyboard.type('Computer Science Internship');
    await this.page.keyboard.press('Enter');
    // select the internship filter option
    await this.page.waitForTimeout(3000);
    await this.page.click('div[class="mat-form-field-infix"]');
    await this.page.waitForTimeout(3000);
    await this.page.click('#mat-option-17');
    await this.page.click('#soc-custom-loading-screen');
    await this.page.waitForTimeout(5000);

  }

  async generateListings() {
    await super.generateListings();
    await this.setSearch();
    await this.page.waitForSelector('.mat-paginator-range-label');
    const range = await super.getValue('div[class="mat-paginator-range-label"]', 'innerText');
    let internshipCount = range.toString();
    internshipCount = internshipCount.slice(internshipCount.indexOf('f') + 2, internshipCount.length);
    internshipCount = parseInt(internshipCount, 0);
    const pageCount = Math.floor(internshipCount/20);

    let urls = [];
    // for the available amount of pages
    for (let i = 0; i < pageCount; i++) {
      await this.page.waitForTimeout(3000);
      urls = urls.concat(await super.getValues('a[class="opportunity-heading pr-6 open-sans opportunity-title ng-tns-c30-168 ng-star-inserted"]', 'href'));
      await this.page.waitForSelector('button[class="mat-paginator-navigation-next mat-icon-button"]');
      await this.page.click('button[class="mat-paginator-navigation-next mat-icon-button"]');
    }

    for (let j = 0; j < urls.length; j++) {
      await this.page.goto(urls[j]);
      let position = await super.getValue('span[class="opportunity-heading pr-6 open-sans ng-tns-c39-8 ng-star-inserted"]', 'innerText');
      let description = await super.getValue('span[class="pb-8 mat-body-1 wrap-text"]', 'innerText');
      const jobLocation = await super.getValue('div[class="pl-6"]', 'innerText');
      const locationTuple = jobLocation.split(', ');
      let location = { city: locationTuple[0], state: locationTuple[1], country: 'United States' };
      let company = ' ';
      const listing = new Listing({ url: urls[j], position: position, location: location, company: company, description: description });
      this.listings.addListing(listing);
    }

  }

  async processListings() {
    await super.processListings();
    // here is where you do any additional processing on the raw data now available in the this.listings field.
  }

}
