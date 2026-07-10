import { db } from './schema';
import { platform } from '@platform';

/**
 * Resolves the favicon URL for a given domain/URL.
 * 1. Checks faviconCache. If found, returns the Base64 dataUrl.
 * 2. If not found, returns the platform-specific resolver URL,
 *    and spawns a background task to fetch, base64-encode, and cache it.
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
  const resolverUrl = platform.getFaviconUrl(url, domain);

  // Background fetch to cache favicon
  fetchAndCacheFavicon(resolverUrl, domain).catch(() => {
    // Gracefully ignore fetch errors (e.g. CORS on Google S2 in web target, offline mode, etc.)
  });

  return resolverUrl;
}

/**
 * Fetches the image URL, converts to base64, and stores in Dexie faviconCache.
 */
async function fetchAndCacheFavicon(imageUrl: string, domain: string): Promise<void> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return;

    const blob = await response.blob();
    // Only cache if it is a valid image type
    if (!blob.type.startsWith('image/')) return;

    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;
        try {
          await db.faviconCache.put({
            domain,
            dataUrl,
            fetchedAt: new Date().toISOString()
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    // Ignore CORS / Network errors
  }
}
