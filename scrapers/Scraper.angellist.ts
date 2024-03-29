import { Scraper } from './Scraper';
import _ from 'underscore';

const prefix = require('loglevel-plugin-prefix');

export class AngelListScraper extends Scraper {
  constructor() {
    super({ name: 'angellist', url: 'https://angel.co/login' });
  }

  public async autoScroll() {
    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400; // this.viewportHeight?
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

  async launch() {
    await super.launch();
    prefix.apply(this.log, { nameFormatter: () => this.name.toUpperCase() });
    this.log.warn(`Launching ${this.name.toUpperCase()} scraper`);
  }

  /**
   * Get the credentials, and throw an Error if we can't find them in the config file.
   */
  async login() {
    await super.login();
    let username;
    let password;
    try {
      username = this.config['credentials']['angellist']['user'];
      password = this.config['credentials']['angellist']['password'];
    } catch (error) {
      throw new Error('Could not find Angel List credentials in config file!');
    }
    await this.page.goto(this.url, { waitUntil: 'load', timeout: 0 });
    await this.page.waitForSelector('input[id="user_email"]');
    await this.page.type('input[id="user_email"]', username);
    await this.page.type('input[id="user_password"]', password);
    // See: https://pptr.dev/#?product=Puppeteer&version=v10.4.0&show=api-pagewaitfornavigationoptions
    await Promise.all([
      this.page.click('input[class="c-button c-button--blue s-vgPadLeft1_5 s-vgPadRight1_5"]'),
      this.page.waitForNavigation()
    ]);
  }

  public async setFilter() {
    await this.page.waitForSelector('a[class="styles_component__1c6JC styles_defaultLink__1mFc1 styles_information__1TxGq"]');
    await this.page.click('div[class="styles_roleWrapper__2xVmi"] > button');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.type('Engineering');
    await this.page.keyboard.press('Enter');
    await this.page.click('div[class="styles_locationWrapper__ScGs8"] > button');
    await this.page.keyboard.press('Backspace');
    await this.page.keyboard.type('United States');
    await this.page.keyboard.press('Enter');
    await this.page.click('button[class="styles_component__3A0_k styles_secondary__2g46E styles_small__6SIIc styles_toggle__3_6jN"]');
    await this.page.waitForSelector('button[class="styles_component__3A0_k styles_primary__3xZwV styles_small__6SIIc styles_emphasis__KRjK8"]');
    if (await this.page.$('div[class="styles_component__3ztKJ styles_active__3CAxI"] > div[class="styles_header__PMZlN"] > button') !== null) {
      // click clear
      await this.page.click('div[class="styles_component__3ztKJ styles_active__3CAxI"] > div[class="styles_header__PMZlN"] > button');
      await this.page.click('label[for="form-input--jobTypes--internship"]');
    } else {
      await this.page.click('label[for="form-input--jobTypes--internship"]');
    }
  }


  async generateListings() {
    await super.generateListings();
    // await this.setFilter();
    await this.page.click('div[class="styles_footer__3DmVI"] > button[class="styles_component__3A0_k styles_primary__3xZwV styles_small__6SIIc styles_emphasis__KRjK8"]');
    for (let i = 0; i < 3; i++) {
      // this.autoScroll appears to be busted.
      // await this.autoScroll();
    }
    // gets elements for length for loop
    let elements = await this.page.evaluate(
      () => Array.from(
        document.querySelectorAll('a[class="styles_component__1c6JC styles_defaultLink__1mFc1 styles_information__1TxGq"]'),
        a => a.getAttribute('href'),
      ),
    );

    elements = _.uniq(elements);
    this.log.info(`Found ${elements.length} listings`);
  }

  async processListings() {
    await super.processListings();
    // here is where you do any additional processing on the raw data now available in the this.listings field.
  }

}
