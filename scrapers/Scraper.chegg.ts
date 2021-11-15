import { Listing } from './Listing';
import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class CheggScraper extends Scraper {
  constructor() {
    super({ name: 'chegg', url: 'https://www.internships.com/app/search' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  // autoscroll scrolls to the last element in the div using scrollIntoView
  async autoscroll() {
    // Select last child
    await this.page.waitForSelector('div[class="GridItem_gridItem__1MSIc GridItem_clearfix__4PbqP ' +
      'GridItem_clearfix__4PbqP"]:last-child');

    // We wait to get the last child then when we get the last child we scroll it into view
    await this.page.$eval('div[class="GridItem_gridItem__1MSIc GridItem_clearfix__4PbqP ' +
      'GridItem_clearfix__4PbqP"]:last-child', e => {
      e.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'end' });
    });
  }

  async generateListings() {
    await super.generateListings();

    await super.goto('https://www.internships.com/app/search?keywords=computer+science&position-types=internship&location=Hawaii&context=seo&seo-mcid=33279397626109020301048056291448164886');

    await this.page.waitForTimeout(1000); //WAIT FOR PAGE TO FULLY LOAD

    //Selects the divs that we want to get information from, EXTRA failsafe just in case waiting does not work, we wait until the element is visible
    await this.page.waitForSelector('div[class="GridItem_jobContent__ENwap"]', { visible: true });

    //Create an array called elements which is an array of all the internship boxes on the chegg page
    let elements = await this.page.$$('div[class="GridItem_jobContent__ENwap"]');

    this.log.info(`Found ${elements.length} internships (initially).`);

    // This for loop loops through the elements array.
    // After we select and click the div that contains the internship we want and add the listing.
    // Then go back a page and refresh the elements array refilling it with new internships that loaded.
    for (let i = 0; i < elements.length; i++) {

      await Promise.all([
        this.page.waitForSelector('div[class="GridItem_jobContent__ENwap"]', { visible: true }),
        elements[i].click(),
        this.page.waitForNavigation(),
      ]);

      let url = this.page.url();
      ((i % 20) === 0) ? this.log.info(`Processing URL ${i}`) : this.log.debug(`Processing URL ${i}:`, url);

      const position = (await super.getValue('h1[class="DesktopHeader_title__2ihuJ"]', 'innerText'));
      const description = (await super.getValue('div[class="ql-editor ql-snow ql-container ql-editor-display ' +
        'Body_rteText__U3_Ce"]', 'innerText'));
      const companySelector = 'a[class="Link_anchor__1oD5h Link_linkColoring__394wp Link_medium__25UK6 ' +
        'DesktopHeader_subTitle__3k6XA"]';
      // If company selector exists return the value else return an empty string
      const company = (await super.selectorExists(companySelector) ? await super.getValue(companySelector, 'innerText') : '');
      const location = (await super.getValue('span[class="DesktopHeader_subTitle__3k6XA ' +
        'DesktopHeader_location__3jiWp"]', 'innerText'));
      const posted = (await super.getValue('p[class="DesktopHeader_postedDate__11t-5"]', 'innerText'));
      this.log.debug(position, description, company, location, posted);

      const listing = new Listing({ url, position, location, company, description, posted });
      this.listings.addListing(listing);

      // Go back to original page with all the listings
      await this.page.goBack();
      await this.page.waitForTimeout(3000); //Have to wait till page is loaded might need a better way to do this
      // EXTRA failsafe just in case waiting does not work, we wait until the element is visible
      await this.page.waitForSelector('div[class="GridItem_jobContent__ENwap"]', { visible: true });

      // Refill elements array with new recently loaded boxes
      elements = await this.page.$$('div[class="GridItem_jobContent__ENwap"]');
    }
  }


  // here is where you do any additional processing on the raw data now available in the this.listings field.
  async processListings() {
    await super.processListings();
    this.log.info('Processing Listings');
    var removedCount = 0; //the number of non relevant listings removed
    const words = ['Computer Science', 'programming', 'software']; //the words we want to search for in the description

    // TODO: Replace this with filter() at some point.
    this.listings.forEach(function (listing, index, object) {
      //This tests to see if some words from our array are in the description, returns true if there is
      const test = words.some(word => listing.description.includes(word));
      //If the test fails then we remove the element from the listings
      if (!test) {
        //splice will remove the non-matching object
        removedCount += 1;
        object.splice(index, 1);
      }
    });
    this.log.info(`Removed ${removedCount} nonrelevant listings, total now: ${this.listings.length()}`);
  }
}
