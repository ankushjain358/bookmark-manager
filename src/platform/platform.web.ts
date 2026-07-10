import { type PlatformAdapter } from './types';

export const platform: PlatformAdapter = {
  isExtension: false,
  getFaviconUrl(_url: string, domain: string): string {
    // Falls back to Google S2 favicon service for the web build
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
  },
  async getCurrentTabUrl(): Promise<string | null> {
    return null;
  }
};
