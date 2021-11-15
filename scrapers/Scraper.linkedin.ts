import { Scraper } from './Scraper';

const prefix = require('loglevel-plugin-prefix');

export class LinkedinScraper extends Scraper {
  constructor() {
    super({ name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/search?keywords=Computer%2BScience&location=United%2BStates&geoId=103644278&trk=public_jobs_jobs-search-bar_search-submit&f_TP=1%2C2%2C3%2C4&f_E=1&f_JT=I&redirect=false&position=1&pageNum=0' });
  }

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);

  }


  async getData() {
    const results = [];
    results.push(await super.getValue( 'h1[class="top-card-layout__title topcard__title"]', 'innerHTML'));
    results.push(await super.getValue('a[class="topcard__org-name-link topcard__flavor--black-link"]', 'innerHTML'));
    results.push(await super.getValue('span[class="topcard__flavor topcard__flavor--bullet"]', 'innerHTML'));
    results.push(await super.getValue('span[class="posted-time-ago__text topcard__flavor--metadata"]', 'innerHTML'));
    results.push(await super.getValues('div[class="show-more-less-html__markup show-more-less-html__markup--clamp-after-5"]', 'innerHTML'));
    return results;
  }

  /**
   * Scrolls down a specific amount every 4 milliseconds.
   * @param page The page we are scrolling.
   * @returns {Promise<void>}
   */
  async autoScroll() {
    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 400);
      });
    });
  }

  async reload() {
    await this.page.goto(this.url);
    await this.page.waitForSelector('a[class="base-card__full-link"]');
    this.log.info('Fetching jobs...');
    await this.autoScroll();
    await this.page.waitForTimeout(5000);
    await this.autoScroll();
    let loadMore = true;
    let loadCount = 0;
    // Sometimes infinite scroll stops and switches to a "load more" button
    while (loadMore === true && loadCount <= 40) {
      try {
        await this.page.waitForTimeout(5000);
        if (await this.page.waitForSelector('button[data-tracking-control-name="infinite-scroller_show-more"]')) {
          await this.page.click('button[data-tracking-control-name="infinite-scroller_show-more"]');
        } else {
          await this.autoScroll();
        }
        loadCount++;
      } catch (e2) {
        loadMore = false;
        this.log.debug('Finished loading...');
      }
    }
  }

  async convertPostedToDate(posted) {
    const date = new Date();
    let daysBack = 0;
    if (posted.includes('hours') || (posted.includes('hour')) || (posted.includes('minute'))
      || (posted.includes('minutes')) || (posted.includes('moment')) || (posted.includes('second'))
      || (posted.includes('seconds')) || (posted.includes('today'))) {
      daysBack = 0;
    } else if ((posted.includes('week')) || (posted.includes('weeks'))) {
      daysBack = posted.match(/\d+/g) * 7;
    } else if ((posted.includes('month')) || (posted.includes('months'))) {
      daysBack = posted.match(/\d+/g) * 30;
    } else {
      daysBack = posted.match(/\d+/g);
    }
    date.setDate(date.getDate() - daysBack);
    return date;
  }

  async generateListings() {
    await super.generateListings();
    await this.reload();
    let totalInternships = 0;
    let urls = await super.getValues('a[class="base-card__full-link"]', 'href');

    this.log.info('Total URLs:', urls.length);
    this.log.info('URLs:', urls);
    const skippedURLs = [];
    const lastScraped = new Date();

    for (let i = 0; i < urls.length; i++) {
      try {
        try {
          this.log.debug('getting data for element ', i);
          await this.page.goto(urls[i]);
          await this.page.waitForSelector('button[class="show-more-less-html__button show-more-less-html__button--more"]', {timeout: 1500});
          this.log.debug('url: ', urls[i]);

          let [position, company, location, posted, description] = await this.getData();
          this.log.debug(`Got data:\n position: ${position}\n company: ${company}\n location: ${location}\n posted:${posted}\n description: ${description}`);
          // let state = '';
          // if (!location.match(/([^,]*)/g)[2]) {
          //   state = 'United States';
          // } else {
          //   state = location.match(/([^,]*)/g)[2].trim();
          // }
          this.listings.addListing({
            position: position,
            company: company,
            // location: {
            //   city: location.match(/([^,]*)/g)[0],
            //   state: state,
            // },
            posted: posted,
            url: urls[i],
            lastScraped: lastScraped,
            description: description,
          });
          this.log.info(position);
          totalInternships++;
        } catch (err5) {
          this.log.info('LinkedIn', err5);
          this.log.info('Skipping! Did not load...');
          skippedURLs.push(urls[i]);
        }
      } catch (e2) {
        this.log.info('Navigated off site... Redirecting back...');
        await this.reload();
        urls = await super.getValues('a.result-card__full-card-link', 'href');
      }
    }

    this.log.info('--- Going back to scrape the ones previously skipped ---');
    // scraping the ones we skipped
    for (let i = 0; i < skippedURLs.length; i++) {
      try {
        await this.page.goto(skippedURLs[i]);
        const skills = 'N/A';
        let [position, company, location, posted, description] = await this.getData();
        this.log.debug(`Got data:\n position: ${position}\n company: ${company}\n location: ${location}\n posted:${posted}\n description: ${description}`);

        // let state = '';
        // if (!location.match(/([^,]*)/g)[2]) {
        //   state = 'United States';
        // } else {
        //   state = location.match(/([^,]*)/g)[2].trim();
        // }
        this.listings.addListing({
          position: position,
          company: company,
          // location: {
          //   city: location.match(/([^,]*)/g)[0].trim(),
          //   state: state.trim(),
          // },
          posted: posted,
          url: skippedURLs[i],
          skills: skills,
          lastScraped: lastScraped,
          description: description,
        });
        this.log.info(position);
        totalInternships++;
      } catch (err5) {
        this.log.info('LinkedIn', err5);
        this.log.info('Skipping! Did not load....');
      }

    }
    this.log.info('Total internships scraped:', totalInternships);
    this.log.info('Closing browser!');
  }
}
