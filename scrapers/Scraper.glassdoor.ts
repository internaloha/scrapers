import { Listing } from './Listing';
import { Scraper } from './Scraper';

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
    await this.page.goto(this.url);
    let urls = [];
    let descriptions = [];
    let positions = [];
    let locations = [];
    let companies =[];

    urls = urls.concat(await super.getValues('a[class="jobLink"]', 'href'));

    for (let j = 2; j < 30; j++) {
      await this.page.goto(`https://www.glassdoor.com/Job/us-computer-science-intern-jobs-SRCH_IL.0,2_IN1_KO3,26_IP${j}.htm?fromAge=14&includeNoSalaryJobs=true&jobType=internship&sortBy=date_desc&pgc=AB4AAoEAPAAAAAAAAAAAAAAAAbsADWUAcAEBARYLPplTgwz6w5gkUFSL%2FblhjH2dnpaNeUYZXuH6Cu3v8isCPy16PzrVdNdet7UF1fZYJ6qrDq1oVrnKpdztukcmJhLXfw0O24fRE0%2B5tWtrBFKzBwo1%2Bd0fZppHS9r3QIn3v1WdnCbnV9BKa%2B4AAA%3D%3D`);
      urls = urls.concat(await super.getValues('a[class="jobLink"]', 'href'));
    }
    /**
    const nextLink = 'a[data-test="pagination-next"]';
    while (await super.selectorExists(nextLink)) {
      await this.page.click(nextLink);
      urls = urls.concat(await super.getValues('a[class="jobLink"]', 'href'));
    }
    **/
    this.log.debug(`Found ${urls.length} URLs: \n${urls}`);

    for (const url of urls) {
      this.log.debug(`Processing: ${url}`);
      await this.page.goto(url);
      positions.push(await super.getValue('div[class="css-17x2pwl e11nt52q6"]', 'innerText'));
      companies.push(await super.getValue('div[class="css-16nw49e e11nt52q1"]', 'innerText'));
      descriptions.push(await super.getValue('div[class="tabSection p-std mt-0"]', 'innerText'));
      const location = await super.getValue('div[class="css-1v5elnn e11nt52q2"]', 'innerText');
      const locationTuple = location.split(', ');
      locations.push({ city: locationTuple[0], state: locationTuple[1], country: 'United States' });
    }
    for (let i = 0; i < urls.length; i++) {
      const listing = new Listing({ url: urls[i], position: positions[i], location: locations[i], company: companies[i], description: descriptions[i] });
      this.listings.addListing(listing);
    }
  }
}
