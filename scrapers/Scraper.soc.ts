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

  async generateListings() {
    await super.generateListings();
    // here is where you traverse the site and populate your this.Listings field with the listings.
  }

  async processListings() {
    await super.processListings();
    // here is where you do any additional processing on the raw data now available in the this.listings field.
  }

}
