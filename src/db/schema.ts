import Dexie, { type Table } from 'dexie';

export interface Page {
  id?: number;
  name: string;
  order: number;
  createdAt: string;
}

export interface Section {
  id?: number;
  pageId: number;
  name: string;
  order: number;
  createdAt: string;
}

export interface Link {
  id?: number;
  sectionId: number;
  title: string;
  url: string;
  normalizedUrl: string; // domain + path (lowercased, default port stripped, no trailing slash)
  faviconDomain: string; // extracted from URL
  order: number;
  tags?: string[];
  createdAt: string;
}

export interface FaviconCache {
  domain: string; // primary key
  dataUrl: string; // base64 encoded string or raw svg
  fetchedAt: string;
}

export class LinkHubDatabase extends Dexie {
  pages!: Table<Page, number>;
  sections!: Table<Section, number>;
  links!: Table<Link, number>;
  faviconCache!: Table<FaviconCache, string>;

  constructor() {
    super('LinkHubDB');
    this.version(1).stores({
      pages: '++id, order',
      sections: '++id, pageId, order',
      links: '++id, sectionId, normalizedUrl, order',
      faviconCache: 'domain'
    });
  }
}

export const db = new LinkHubDatabase();
