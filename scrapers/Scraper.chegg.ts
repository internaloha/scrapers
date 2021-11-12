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

    this.log.info('Obtaining and adding internships');

    // This for loop loops through the elements array.
    // After we select and click the div that contains the internship we want and add the listing.
    // Then go back a page and refresh the elements array refilling it with new internships that loaded.
    for (let i = 0; i < elements.length; i++) {

      // This code ensures that both the click() and the waitForNavigation() complete before the script proceeds to the next
      // command.
      await Promise.all([
        this.page.waitForSelector('div[class="GridItem_jobContent__ENwap"]', { visible: true }),
        elements[i].click(),
        this.page.waitForNavigation(),
      ]);

      let url = this.page.url();

      const position = (await super.getValue('h1[class="DesktopHeader_title__2ihuJ"]', 'innerText'));
      this.log.debug(`Position: \n${position}`);

      const description = (await super.getValue('div[class="ql-editor ql-snow ql-container ql-editor-display ' +
        'Body_rteText__U3_Ce"]', 'innerText'));
      this.log.debug(`Description: \n${description}`);

      // Sometimes the company selector does not exist, so if its not there we just set it to an empty string
      const company = (await this.page.$('a[class="Link_anchor__1oD5h Link_linkColoring__394wp Link_medium__25UK6 DesktopHeader_subTitle__3k6XA"]', 'innerText')) || '';
      this.log.debug(`Company: \n${company}`);

      const location = (await super.getValue('span[class="DesktopHeader_subTitle__3k6XA ' +
        'DesktopHeader_location__3jiWp"]', 'innerText'));
      this.log.debug(`Location: ${location}`);

      const posted = (await super.getValue('p[class="DesktopHeader_postedDate__11t-5"]', 'innerText'));

      const listing = new Listing({ url, position, location, company, description, posted });
      this.log.debug(`Adding Listing ${listing.url}`); //Used to verify that a listing is being added
      this.listings.addListing(listing);

      // Go back to original page with all the listings
      await this.page.goBack();
      await this.page.waitForTimeout(3000); //Have to wait till page is loaded might need a better way to do this

      // EXTRA failsafe just in case waiting does not work, we wait until the element is visible
      await this.page.waitForSelector('div[class="GridItem_jobContent__ENwap"]', { visible: true });

      // Refill elements array with new recently loaded boxes
      elements = await this.page.$$('div[class="GridItem_jobContent__ENwap"]');

    }

    this.log(`Added ${this.listings.length()}`);

  }

  // here is where you do any additional processing on the raw data now available in the this.listings field.
  async processListings() {
    await super.processListings();
    this.log.info('Processing Listings');
    var removedCount = 0;

    this.listings.forEach(function (listing, index, object) {
      if (listing.description.indexOf('Computer Science') < 0 || listing.description.indexOf('programming') < 0 || listing.description.indexOf('software') < 0) {
        //splice will remove the non-matching element
        console.log(object);
        removedCount += 1;
        object.splice(index, 1);
      }
    }
    );

    this.log.info(`Removed ${removedCount} nonrelevant listings`);
    this.log.info(`Total of listing added after processing: ${this.listings.length()}`);
  }

}
