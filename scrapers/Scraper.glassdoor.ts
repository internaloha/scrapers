import { Listing } from './Listing';
import { Scraper } from './Scraper';
import _ from 'underscore';

const prefix = require('loglevel-plugin-prefix');

export class GlassDoorScraper extends Scraper {
  constructor() {
    super({ name: 'glassdoor', url: 'https://www.glassdoor.com/Job/us-computer-science-intern-jobs-SRCH_IL.0,2_IN1_KO3,26.htm?fromAge=14&jobType=internship&sortBy=date_desc&pgc=AB4AAIEAAAAAAAAAAAAAAAAAAbsADWUAAwAAAQAA' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  async generateListings() {
    await super.generateListings();
    await super.goto(this.url);
    let urls = [];
    let descriptions = [];
    let positions = [];
    let locations = [];
    let companies =[];
    this.log.info('Retrieving page 1 of URLs.');
    //retrieve the urls of page 1
    urls = urls.concat(await super.getValues('a[class="jobLink"]', 'href'));
    // retrieve the total number of pages
    let key = await super.getValue('div[class="cell middle d-none d-md-block py-sm"]', 'innerText');
    key = key.split(' ');
    const numberOfPages = key[3];

    // Retrieve a maximum of 10 pages of listings.
    const pagesToProcess = (numberOfPages < 10) ? numberOfPages : 10;
    // for each j starting from 2 iterate the number of available pages of internship
    for (let j = 2; j < pagesToProcess; j++) {
      const message = `Retrieving page ${j} of ${pagesToProcess}. ${urls.length} URLs found so far.`;
      ((j % 5) === 0) ? this.log.info(message) : this.log.debug(message);
      await this.page.goto(`https://www.glassdoor.com/Job/us-computer-science-intern-jobs-SRCH_IL.0,2_IN1_KO3,26_IP${j}.htm?fromAge=14&includeNoSalaryJobs=true&jobType=internship&sortBy=date_desc&pgc=AB4AAoEAPAAAAAAAAAAAAAAAAbsADWUAcAEBARYLPplTgwz6w5gkUFSL%2FblhjH2dnpaNeUYZXuH6Cu3v8isCPy16PzrVdNdet7UF1fZYJ6qrDq1oVrnKpdztukcmJhLXfw0O24fRE0%2B5tWtrBFKzBwo1%2Bd0fZppHS9r3QIn3v1WdnCbnV9BKa%2B4AAA%3D%3D`, { waitUntil: 'networkidle0' });
      urls = urls.concat(await super.getValues('a[class="jobLink"]', 'href'));
    }

    // there can be lots of duplicates in this list, so get rid of them.
    urls = _.uniq(urls);

    this.log.info(`Found a total of ${urls.length} Internship URLs`);
    // for each url in the list
    for (let k = 0; k < urls.length; k++) {
      ((k % 20) === 0) ? this.log.info(`Processing URL ${k}`) : this.log.debug(`Processing URL:`, urls[k]);
      // go to the page and retrieve its relative information
      await super.goto(urls[k]);
      positions.push(await super.getValue('div[class="css-17x2pwl e11nt52q6"]', 'innerText'));
      companies.push(await super.getValue('div[class="css-16nw49e e11nt52q1"]', 'innerText'));
      descriptions.push(await super.getValue('div[class="tabSection p-std mt-0"]', 'innerText'));
      const location = await super.getValue('div[class="css-1v5elnn e11nt52q2"]', 'innerText');
      const locationTuple = location.split(', ');
      locations.push({ city: locationTuple[0], state: locationTuple[1], country: 'United States' });
    }
    // for each url create a listing and add it
    for (let i = 0; i < urls.length; i++) {
      const listing = new Listing({ url: urls[i], position: positions[i], location: locations[i], company: companies[i], description: descriptions[i] });
      this.listings.addListing(listing);
    }
  }
}
