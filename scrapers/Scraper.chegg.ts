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

    await super.goto('https://www.internships' +
      '.com/app/search?keywords=computer+science&position-types=internship&location=Hawaii&context=seo&seo-mcid' +
      '=33279397626109020301048056291448164886');

    await this.page.waitForTimeout(1000); //WAIT FOR PAGE TO FULLY LOAD

    //Selects the divs that we want to get information from, EXTRA failsafe just in case waiting does not work, we wait until the element is visible
    await this.page.waitForSelector('div[class="GridItem_jobContent__ENwap"]', { visible: true });

    //Create an array called elements which is an array of all the internship boxes on the chegg page
    let elements = await this.page.$$('div[class="GridItem_jobContent__ENwap"]');

    this.log.info('Obtaining and adding internships');

    // This for loop loops through the elements array.
    // After we select and click the div that contains the internship we want. After we add the listing.
    // Then go back a page and refresh the elements array refilling it with new internships that loaded.
    for (let i = 0; i < elements.length; i++) {

      await this.page.waitForSelector('div[class="GridItem_jobContent__ENwap"]', { visible: true });
      await elements[i].click();
      await this.page.waitForTimeout(3000); // Wait till page is loaded. Might need a better way to do this?

      let url = this.page.url();

      const position = (await super.getValues('h1[class="DesktopHeader_title__2ihuJ"]', 'innerText'))[0];
      this.log.debug(`Descriptions: \n${position}`);

      //use super.getvalue

      const description = (await super.getValues('div[class="ql-editor ql-snow ql-container ql-editor-display ' +
        'Body_rteText__U3_Ce"]', 'innerText'))[0];
      this.log.debug(`Descriptions: \n${description}`);

      const company = (await super.getValues('a[class="Link_anchor__1oD5h ' +
        'Link_linkColoring__394wp ' +
        'Link_medium__25UK6 DesktopHeader_subTitle__3k6XA"]', 'innerText'))[0];
      this.log.debug(`Descriptions: \n${company}`);

      const locationStr = (await super.getValues('span[class="DesktopHeader_subTitle__3k6XA ' +
        'DesktopHeader_location__3jiWp"]', 'innerText'))[0];


      const loc = locationStr.split(', ');
      const city = (loc.length > 0) ? loc[0] : '';
      const state = (loc.length > 1) ? loc[1] : '';
      const country = '';

      const location = { city, state, country };

      this.log.debug(`Location: {${city}, ${state}, ${country}}`);

      const posted = (await super.getValues('p[class="DesktopHeader_postedDate__11t-5"]', 'innerText'))[0];

      const listing = new Listing({ url, position, location, company, description, posted });
      this.log.debug(`Adding Listing ${listing.url}`); //Used to verify that a listing is being added


      this.listings.addListing(listing);

      //Go back to original page
      await this.page.goBack();
      await this.page.waitForTimeout(3000); //Have to wait till page is loaded might need a better way to do this

      //EXTRA failsafe just in case waiting does not work, we wait until the element is visible
      await this.page.waitForSelector('div[class="GridItem_jobContent__ENwap"]', { visible: true });

      //Refill elements array with new recently loaded boxes
      elements = await this.page.$$('div[class="GridItem_jobContent__ENwap"]');

    }
  }

  // here is where you do any additional processing on the raw data now available in the this.listings field.
  async processListings() {
    await super.processListings();
    this.log.info('Processing Listings');
    //const words = ['computer science', 'software', 'engineering', 'computers', 'programming' ];
    var removedCount = 0;

    // Our search words will contain computer science, software, engineering, computers, programming
    // If the description does not contain these words we remove the object from the array
    function filterArray( arr ) {
      var i = arr.length - 1;
      //-- Loop through the array in reverse order since we are modifying the array.
      while ( i >= 0) {
        console.log(arr[i].description);
        if (arr[i].description.indexOf('Computer Science') < 0) {
          //-- splice will remove the non-matching element
          removedCount += 1;
          arr.splice(i, 1);
        }
        i--;
      }
      return arr;
    }

    this.log.info(`Removed ${removedCount}  nonrelevant listings`);
    filterArray(this.listings);
    this.log.info(`Total of listing added after Processing ${this.listings.length()}`);
  }

}
