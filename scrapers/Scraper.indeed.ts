import { Listing } from './Listing';
import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class IndeedScraper extends Scraper {
  constructor() {
    super({ name: 'indeed', url: 'https://www.indeed.com/jobs?q=computer%20science%20internship&l=Honolulu%2C%20HI&vjk=4d4385fce8630e4b' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async login() {
    await super.login();
    // if you need to login, put that code here.
  }

  async generateListings() {
    await super.generateListings();
    let pageNum = 1;
    //const listingsTable = '#mosaic-zone-jobcards';

    // pageUrl returns an URL containing the specified page number.
    const pageUrl = (pageNum) =>
      `https://www.indeed.com/jobs?q=computer%20science%20internship&l=Honolulu%2C%20HI&vjk=4d4385fce8630e4b&page=${pageNum}`;

    // Get the first page of Internship listings.
    await super.goto(pageUrl(pageNum));

    //Selects the divs that we want to get information from, we wait until the element is visible
    await this.page.waitForSelector('h2[class="jobTitle jobTitle-color-purple"]', { visible: true });

    //Create an array called elements which is an array of all the internship boxes on the indeed page
    let elements = await this.page.$$('h2[class="jobTitle jobTitle-color-purple"]');

    for (let i = 0; i < elements.length; i++) {

      // This code ensures that both the click() and the waitForNavigation() complete before the script proceeds to the next
      // command.
      // using the option middle allows us to open the element in a new tab
      let options = { button: 'middle' };
      await Promise.all([
        this.page.waitForSelector('h2[class="jobTitle jobTitle-color-purple"]', { visible: true }),
        elements[i].click(options),

      ]);

      this.log.debug('current tab count ', (await this.browser.pages()).length);

      //After openning a new tab we create an array of all the tabs in the browser
      const tabs = await this.browser.pages();

      //we get the location of the newest tab
      const newTab = tabs[tabs.length - 1];

      //get a target of the new tab
      const newtabTarget = newTab.target();

      //save a url of the new tab
      const newTabUrl = newtabTarget.url();

      //now we go to that url we got from the new tab
      await super.goto(newTabUrl);

      let url = this.page.url();

      //const company = (await super.getValue('div[class="jobsearch-InlineCompanyRating icl-u-xs-mt--xs jobsearch-DesktopStickyContainer-companyrating"] > div', 'innerText'));
      const company = 'Cat';
      this.log.debug(`Company: \n${company}`);

      const position = (await super.getValue('h1[class="icl-u-xs-mb--xs icl-u-xs-mt--none jobsearch-JobInfoHeader-title"]', 'innerText'));
      this.log.debug(`Position: \n${position}`);

      const description = (await super.getValue('div[class="jobsearch-JobComponent-description icl-u-xs-mt--md"]', 'innerText'));
      this.log.debug(`Description: \n${description}`);

      const location = { state: 'Hawaii', city: 'Honolulu', country: 'US' };
      const listing = new Listing({ url, position, location, company, description });
      this.listings.addListing(listing);

      //we close the new tab after scraping the page
      newTab.close();

      // Go back to original page with all the listings
      await this.page.goBack();
      await this.page.waitForTimeout(3000); //Have to wait till page is loaded might need a better way to do this

      // EXTRA failsafe just in case waiting does not work, we wait until the element is visible
      await this.page.waitForSelector('h2[class="jobTitle jobTitle-color-purple"]', { visible: true });

      // Refill elements array elements
      elements = await this.page.$$('h2[class="jobTitle jobTitle-color-purple"]');

    }

  }


  async processListings() {
    await super.processListings();
    // here is where you do any additional processing on the raw data now available in the this.listings field.
  }

}
