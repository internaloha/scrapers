export interface Location {
  city: string;
  state: string;
  country: string;
}

export interface ListingData {
  url: string,
  position: string;
  location: Location;
  description: string;
  company: string;
  contact?: string;
  posted?: string;
  due?: string;
}

export class Listing {
  public url: string;
  public position?: string;
  public location?: Location;
  public description?: string;
  public company?: string;
  public contact?: string;
  public posted?: string;
  public due?: string;
  public lastScraped: Date;

  constructor({ url, position = '', location = { city: '', state: '', country: ''}, description = '', company = '', contact = '', posted = '', due = '' }: ListingData) {
    if (position === '') {
      throw new Error('Empty position string. Position is required.');
    }
    this.url = url;
    this.position = position;
    this.location = location;
    this.description = description;
    this.company = company;
    this.contact = contact;
    this.posted = posted;
    this.due = due;
    this.lastScraped = new Date();
  }
}
