import log from 'loglevel';
import chalk from 'chalk';
import puppeteer from 'puppeteer-extra';
import { Listing } from './Listing';
import { Listings } from './Listings';
import * as prefix from 'loglevel-plugin-prefix';
import * as moment from 'moment';
import * as fs from 'fs';
import * as UserAgent from 'user-agents';

// For some reason, the following package(s) generate TS errors if I use import.
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const StripHtml = require('string-strip-html');

const colors = {
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red,
};

/**
 * Abstract superclass providing the structure and supporting functions for all scrapers.
 */
export class Scraper {
  // public fields are set by the scrape.ts script.
  public config: object;
  public defaultTimeout: number;
  public devtools: boolean;
  public discipline;
  public commitFiles: boolean;
  public headless: boolean;
  public listingDir: string;
  public log: any;
  public minimumListings: number;
  public slowMo: number;
  public statisticsDir: string;
  public viewportHeight: number;
  public viewportWidth: number;
  // protected fields are set by the subclass.
  protected browser;
  protected name: string;
  protected page;
  protected url: string;
  protected listings: Listings;
  protected startTime: Date;
  protected endTime: Date;
  protected errorMessages: string[];
  protected requestHeaders: object;
  protected maxRandomWait: number;

  /** Initialize the scraper state and provide configuration info. */
  constructor({ name, url = '' }) {
    this.name = name;
    this.url = url;
    this.log = log;
    this.errorMessages = [];
    this.requestHeaders = { referer: 'https://www.google.com/' };
    this.maxRandomWait = 5000;
  }

  /**
   * Return a list of field values based on selector.
   * Use this function when you expect the selector to match a list of elements in the page.
   * @param selector The nodes to be selected from the current page.
   * @param field The field to extract from the nodes returned from the selector.
   */
  async getValues(selector, field) {
    return await this.page.$$eval(selector, (nodes, field) => nodes.map(node => node[field]), field);
  }

  /**
   * Return a single field value based on selector.
   * Use this function when you expect the selector match only a single element in the page.
   * @param selector The node to be selected from the current page.
   * @param field The field to extract from the node returned from the selector.
   * @throws Error if there is no element matching the selector.
   */
  async getValue(selector, field) {
    return await this.page.$eval(selector, (node, field) => node[field], field);
  }

  /**
   * Return the nested property value or undefined if any of the intermediate structures don't exist.
   * The "optional chaining proposal" is not currently supported in our typescript.
   * See: https://stackoverflow.com/questions/2631001/test-for-existence-of-nested-javascript-object-key
   *
   * @param obj The object
   * @param args The nested fields.
   */
  getNested(obj, ...args) {
    return args.reduce((obj, level) => obj && obj[level], obj);
  }

  /**
   * Return true if the passed selector appears on the page.
   */
  async selectorExists(selector) {
    return !! await this.page.$(selector);
  }

  /**
   * Allow CLI access to the name of this scraper.
   * Subclass: do not override.
   */
  getName() {
    return this.name;
  }

  /**
   * Set up puppeteer.
   * Subclass: invoke `await super.launch()` first if you override.
   */
  async launch() {
    // Set up logging.
    prefix.reg(this.log);
    prefix.apply(this.log, {
      format(level, logname, timestamp) {
        const color = colors[level.toUpperCase()];
        return `${color(timestamp)} ${color(level)} ${color(logname)}`;
      },
    });

    // Set up the Listings object, now that we know the listingDir, name, and log.
    const listingSubDir = `${this.listingDir}/${this.discipline}`;
    this.listings = new Listings({ listingDir: listingSubDir, name: this.name, log: this.log, commitFiles: this.commitFiles });

    this.startTime = new Date();

    puppeteer.use(StealthPlugin());
    this.browser = await puppeteer.launch({ headless: this.headless, devtools: this.devtools, slowMo: this.slowMo });
    const context = await this.browser.createIncognitoBrowserContext();
    this.page = await context.newPage();
    await this.page.setViewport({ width: this.viewportWidth, height: this.viewportHeight });
    await this.setUserAgent();
    await this.page.setDefaultTimeout(this.defaultTimeout);
    await this.page.setExtraHTTPHeaders(this.requestHeaders);
    await this.page.evaluateOnNewDocument(() => { delete navigator['__proto__']['webdriver']; });
    // Echo console messages from puppeteer in this process
    this.page.on('console', (msg) => this.log.debug(`PUPPETEER CONSOLE: ${msg.text()}`));
  }

  async setUserAgent() {
    const platform = (process.platform === 'darwin') ? 'MacIntel' : 'Win32';
    const options = { deviceCategory: 'desktop', platform };
    const userAgent = new UserAgent(options);
    this.log.debug(`Setting User Agent to: ${userAgent.toString()}.`);
    await this.page.setUserAgent(userAgent.toString());
  }

  async goto(url: string, options = {newUserAgent: true, randomWait: true, waitUntil: 'networkidle0'}) {
    if (options.newUserAgent) {
      await this.setUserAgent();
    }
    await this.page.goto(url, { waitUntil: options.waitUntil });
    if (options.randomWait) {
      await this.randomWait();
    }
  }

  async randomWait() {
    // Wait a minimum of 1 second, and up to this.maxRandomWait additional milliseconds.
    const wait = Math.floor(Math.random() * this.maxRandomWait) + 1000;
    this.log.debug(`Waiting ${wait} milliseconds.`);
    await this.page.waitForTimeout(wait);
  }

  /** Scrolls down 400 pixels every 400 milliseconds until scrolling doesn't increase the page height. */
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

  /**
   * Login to site.
   * Subclass: invoke `await super.login()` if you need to override.
   */
  async login() {
    this.log.debug('Starting login');
  }

  /**
   * Scrapes the page and stores preliminary results in the this.listings field.
   * Subclass: invoke `await super.processListings()` when you override.
   * Processing means extracting the relevant information for writing.
   * @throws Error if a problem occurred parsing this listing.
   */
  async generateListings() {
    this.log.debug('Starting generate listings');
  }

  /** Return the passed description string with initial "junk" keywords removed. */
  stripInitialKeywords(description) {
    return description
      .replace(/^(The position)/, '')
      .replace(/^(What you'll do)/, '')
      .replace(/^(Who are we?)/, '')
      .replace(/^(About the role:)/, '')
      .replace(/^(Why join us)/, '')
      .replace(/^(Who we are)/, '')
      .replace(/^(We are looking for)/, '')
      .replace(/^(The basics)/, '')
      .replace(/^(Company overview)/, '')
      .replace(/^(Position)/, '')
      .replace(/^(About us)/, '')
      .replace(/^(About the job)/, '')
      .replace(/^(Job Brief)/, '')
      .replace(/^(Role & Responsibilities:)/, '')
      .replace(/^(DESCRIPTION:)/, '')
      .replace(/^(Description:)/, '')
      .replace(/^(Description\/Job Summary)/, '')
      .replace(/^(Job Summary)/, '')
      .replace(/^(Your responsibilities include:)/, '')
      .replace(/^(Introduction)/, '')
      .replace(/^(Research Topics\/Keywords:)/, '')
      .replace(/^(What You’ll Do)/, '')
      .replace(/^(Overview)/, '')
      .replace(/^(Job Description)/, '')
      .replace(/^(ABOUT PROGRAM:)/, '')
      .replace(/^(Who We Are)/, '')
      .replace(/^(Responsibilities & Duties)/, '')
      .replace(/^(Full Job Description)/, '')
      .replace(/^(Company Description)/, '')
      .replace(/^(About the Role)/, '')
      .replace(/^(Our Technology:)/, '')
      .replace(/^(More information about this job:)/, '')
      .replace(/^(:)/, '')
      .trim();
  }

  /**
   * Default processing for the description field:
   *   1. Replace 4+ newlines with two newlines.
   *   2. Replace nonbreaking space chars with a normal space char.
   *   3. Strip HTML.
   *   4. Remove 'junk' initial words: https://github.com/radgrad/radgrad2/issues/807
   */
  fixDescription(description) {
    const description1 = description
      .replace(/\n\s*\n\s*\n\s*\n\s*\n\s*\n\s*\n\s*\n/g, '\n\n')
      .replace(/\n\s*\n\s*\n\s*\n\s*\n\s*\n\s*\n/g, '\n\n')
      .replace(/\n\s*\n\s*\n\s*\n\s*\n\s*\n/g, '\n\n')
      .replace(/\n\s*\n\s*\n\s*\n\s*\n/g, '\n\n')
      .replace(/\n\s*\n\s*\n\s*\n/g, '\n\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/\xa0/g, ' ');
    const description2 = StripHtml.stripHtml(description1).result;
    const description3 = this.stripInitialKeywords(description2);
    // Sometimes the keywords come in pairs, so strip again to get the second one.
    const description4 = this.stripInitialKeywords(description3);
    return description4;
  }

  /**
   * Converts posted strings to ISO format. This is ONLY if it follows the format of:
   * Posted: 4 days ago... 3 weeks ago... a month ago
   * @param posted The string
   * @returns {Date}
   */
  convertPostedToDate(posted) {
    const date = new Date();
    let daysBack: number;
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

  /**
   * After the this.listings field is populated, use this method to further process the data.
   * Subclass: invoke `await super.processListings` if you override.
   */
  async processListings() {
    this.log.debug('Starting processListings');
    this.listings.forEach(listing => { listing.description = this.fixDescription(listing.description); });
  }

  /**
   * Writes the listings to a file in listingFilePath.
   * Subclass: generally no need to override.
   */
  async writeListings() {
    this.listings.writeListings();
  }

  /**
   * Writes out statistics about this run.
   * Subclass: generally no need to override.
   */
  async writeStatistics() {
    this.log.debug('Starting write statistics');
    const elapsedTime = Math.trunc((this.endTime.getTime() - this.startTime.getTime()) / 1000);
    const numErrors = this.errorMessages.length;
    const numListings = this.listings.length();
    const suffix = this.commitFiles ? 'json' : 'dev.json';
    const dateString = moment().format('YYYY-MM-DD');
    const filename = `${this.statisticsDir}/${this.discipline}/${this.name}-${dateString}.${suffix}`;
    try {
      const data = { date: dateString, elapsedTime, numErrors, numListings, errorMessages: this.errorMessages, scraper: this.name };
      const dataString = JSON.stringify(data, null, 2);
      fs.writeFileSync(filename, dataString, 'utf-8');
      this.log.info('Wrote statistics.');
    } catch (error) {
      this.log.error(`Error in Scraper.writeStatistics: ${error}`);
    }
  }

  /**
   * Perform any final close-down operations.
   * Subclass: generally no need to override.
   */
  async close() {
    this.log.debug('Starting close');
    this.endTime = new Date();
    await this.browser.close();
    if (this.listings.length() < this.minimumListings) {
      this.log.error(`Generated listings (${this.listings.length()}) less than minimum listings (${this.minimumListings})`);
    }
  }

  /**
   * Runs the scraper.
   * Subclass: do not override.
   */
  async scrape() {
    try {
      await this.launch();
      await this.login();
      await this.generateListings();
    } catch (error) {
      const message = error['message'];
      this.errorMessages.push(message);
      this.log.error(`Error caught in scrape(): ${message}`);
    } finally {
      await this.processListings();
      await this.close();
      await this.writeListings();
      await this.writeStatistics();
    }
  }

  async getListingsObj(fileName) {
    const path = `${this.listingDir}/${this.discipline}/${fileName}`;
    let listingsObj;
    try {
      this.log.info(`Reading listings from ${path}`);
      listingsObj = JSON.parse(fs.readFileSync(path, 'utf8'));
    } catch (Exception) {
      this.log.error(`${path} missing or unable to be parsed. Exiting.`);
      process.exit(0);
    }
    return listingsObj;
  }

  async initializeAndProcessListings(fileName) {
    try {
      await this.launch();
      const listingsObj = await this.getListingsObj(fileName);
      listingsObj.forEach(listingData => {
        const {url = '', position = '', location = {}, company = '', description =  '', contact = '', posted = '', due = '' }= listingData;
        const listing = new Listing({ url, position, location, company, description, contact, posted, due });
        this.listings.addListing(listing);
      });
      await this.processListings();
    } catch (error) {
      const message = error['message'];
      this.errorMessages.push(message);
      this.log.error(`Error caught in scrape(): ${message}`);
    } finally {
      await this.close();
      await this.writeListings();
      await this.writeStatistics();
    }
  }
}
