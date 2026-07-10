import { type PlatformAdapter } from './types';

export const platform: PlatformAdapter = {
  isExtension: true,
  getFaviconUrl(url: string, domain: string): string {
    try {
      // Check if chrome.runtime.id is available, meaning we are in a packed/sideloaded extension environment
      const extensionId = typeof chrome !== 'undefined' && chrome.runtime?.id;
      if (extensionId) {
        return `chrome-extension://${extensionId}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
      }
    } catch (e) {
      console.error('Failed to get chrome extension favicon API', e);
    }
    // Fallback to Google S2 if runtime context is missing (e.g. unpacked dev server)
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
  },
  async getCurrentTabUrl(): Promise<string | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.url || null;
      }
    } catch (e) {
      console.error('Failed to query current tab URL', e);
    }
    return null;
  }
};
