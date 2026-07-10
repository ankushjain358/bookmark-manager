import { db, type Page, type Section, type Link } from './schema';
import { addLinkToIndex, updateLinkInIndex, removeLinkFromIndex } from '../search';

/**
 * Normalizes a URL:
 * - Lowers the hostname
 * - Removes default ports (80 for http, 443 for https)
 * - Removes trailing slash
 * - Excludes protocol (treating http and https as equal)
 */
export function normalizeUrl(urlStr: string): string {
  let cleanUrl = urlStr.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'http://' + cleanUrl;
  }
  try {
    const url = new URL(cleanUrl);
    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    let port = url.port;
    if ((url.protocol === 'http:' && port === '80') || (url.protocol === 'https:' && port === '443')) {
      port = '';
    }
    const portStr = port ? `:${port}` : '';
    let pathname = url.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    return `${host}${portStr}${pathname}${url.search}${url.hash}`;
  } catch (e) {
    return urlStr.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Extracts the domain from a URL for favicon lookup.
 */
export function extractDomain(urlStr: string): string {
  let cleanUrl = urlStr.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = 'http://' + cleanUrl;
  }
  try {
    const url = new URL(cleanUrl);
    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      return host.slice(4);
    }
    return host;
  } catch (e) {
    return 'unknown';
  }
}

// ============================================================================
// PAGE OPERATIONS
// ============================================================================

export async function addPage(name: string): Promise<number> {
  return await db.transaction('rw', db.pages, async () => {
    const pages = await db.pages.toArray();
    const maxOrder = pages.reduce((max, p) => p.order > max ? p.order : max, 0);
    const newPage: Page = {
      name: name.trim(),
      order: maxOrder + 1,
      createdAt: new Date().toISOString()
    };
    return await db.pages.add(newPage);
  });
}

export async function updatePage(id: number, updates: Partial<Page>): Promise<void> {
  await db.pages.update(id, updates);
}

export async function deletePage(id: number): Promise<void> {
  await db.transaction('rw', [db.pages, db.sections, db.links], async () => {
    // Delete page
    await db.pages.delete(id);

    // Find all sections belonging to this page
    const sections = await db.sections.where('pageId').equals(id).toArray();
    const sectionIds = sections.map(s => s.id).filter((sid): sid is number => sid !== undefined);

    if (sectionIds.length > 0) {
      // Find all links belonging to these sections
      const links = await db.links.where('sectionId').anyOf(sectionIds).toArray();
      
      // Delete links
      for (const link of links) {
        if (link.id !== undefined) {
          await db.links.delete(link.id);
          removeLinkFromIndex(link.id);
        }
      }

      // Delete sections
      await db.sections.bulkDelete(sectionIds);
    }
  });
}

// ============================================================================
// SECTION OPERATIONS
// ============================================================================

export async function addSection(pageId: number, name: string): Promise<number> {
  return await db.transaction('rw', db.sections, async () => {
    const pageSections = await db.sections.where('pageId').equals(pageId).toArray();
    const maxOrder = pageSections.reduce((max, s) => s.order > max ? s.order : max, 0);
    const newSection: Section = {
      pageId,
      name: name.trim(),
      order: maxOrder + 1,
      createdAt: new Date().toISOString()
    };
    return await db.sections.add(newSection);
  });
}

export async function addSectionAfter(pageId: number, name: string, targetSectionId: number): Promise<number> {
  return await db.transaction('rw', db.sections, async () => {
    const targetSection = await db.sections.get(targetSectionId);
    if (!targetSection) {
      return await addSection(pageId, name);
    }
    const targetOrder = targetSection.order;
    const sectionsToShift = await db.sections
      .where('pageId')
      .equals(pageId)
      .filter(s => s.order > targetOrder)
      .toArray();
    for (const sec of sectionsToShift) {
      await db.sections.update(sec.id!, { order: sec.order + 1 });
    }
    const newSection: Section = {
      pageId,
      name: name.trim(),
      order: targetOrder + 1,
      createdAt: new Date().toISOString()
    };
    return await db.sections.add(newSection);
  });
}

export async function updateSection(id: number, updates: Partial<Section>): Promise<void> {
  await db.sections.update(id, updates);
}

export async function deleteSection(id: number): Promise<void> {
  await db.transaction('rw', [db.sections, db.links], async () => {
    // Delete section
    await db.sections.delete(id);

    // Delete links inside section
    const links = await db.links.where('sectionId').equals(id).toArray();
    for (const link of links) {
      if (link.id !== undefined) {
        await db.links.delete(link.id);
        removeLinkFromIndex(link.id);
      }
    }
  });
}

// ============================================================================
// LINK OPERATIONS
// ============================================================================

export async function addLink(
  sectionId: number,
  title: string,
  url: string,
  tags: string[] = []
): Promise<number> {
  return await db.transaction('rw', db.links, async () => {
    const sectionLinks = await db.links.where('sectionId').equals(sectionId).toArray();
    const maxOrder = sectionLinks.reduce((max, l) => l.order > max ? l.order : max, 0);
    
    const normalized = normalizeUrl(url);
    const faviconDomain = extractDomain(url);
    
    const newLink: Link = {
      sectionId,
      title: title.trim(),
      url: url.trim(),
      normalizedUrl: normalized,
      faviconDomain,
      order: maxOrder + 1,
      tags,
      createdAt: new Date().toISOString()
    };

    const id = await db.links.add(newLink);
    newLink.id = id;
    addLinkToIndex(newLink);
    return id;
  });
}

export async function updateLink(id: number, updates: Partial<Link>): Promise<void> {
  await db.transaction('rw', db.links, async () => {
    if (updates.url !== undefined) {
      updates.normalizedUrl = normalizeUrl(updates.url);
      updates.faviconDomain = extractDomain(updates.url);
    }
    
    await db.links.update(id, updates);
    
    // Fetch final updated link to update search index
    const updated = await db.links.get(id);
    if (updated) {
      updateLinkInIndex(updated);
    }
  });
}

export async function deleteLink(id: number): Promise<void> {
  await db.transaction('rw', db.links, async () => {
    await db.links.delete(id);
    removeLinkFromIndex(id);
  });
}
