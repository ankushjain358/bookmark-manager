import { db } from './schema';
import { platform } from '@platform';

/**
 * Resolves the favicon URL for a given domain/URL.
 * 1. Checks faviconCache. If found, returns the Base64 dataUrl (or 'failed' state).
 * 2. If not found, returns the platform-specific resolver URL.
 */
export async function getFavicon(url: string, domain: string): Promise<string> {
  if (!domain || domain === 'unknown') {
    return '';
  }

  try {
    const cached = await db.faviconCache.get(domain);
    if (cached && cached.dataUrl) {
      return cached.dataUrl;
    }
  } catch (e) {
    console.error('Error fetching favicon from cache:', e);
  }

  // Get the resolver URL based on build platform (web vs extension)
  return platform.getFaviconUrl(url, domain);
}
