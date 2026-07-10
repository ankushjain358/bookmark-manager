import { db, type Page, type Section, type Link } from '../db/schema';
import { normalizeUrl, extractDomain } from '../db/operations';
import { initSearchIndex } from '../search';

/**
 * Handles database operations for importing pages, sections, and links.
 * Works inside a transaction. Deduplicates pages and sections by case-insensitive name
 * and links by normalizedUrl.
 */
export async function handleImportData(
  pagesList: Page[],
  sectionsList: Section[],
  linksList: Link[],
  mode: 'merge' | 'replace'
): Promise<{
  addedPages: number;
  addedSections: number;
  addedLinks: number;
  skippedLinks: number;
}> {
  return await db.transaction('rw', [db.pages, db.sections, db.links], async () => {
    let addedPages = 0;
    let addedSections = 0;
    let addedLinks = 0;
    let skippedLinks = 0;

    if (mode === 'replace') {
      await db.pages.clear();
      await db.sections.clear();
      await db.links.clear();
    }

    const existingPages = await db.pages.toArray();
    const existingSections = await db.sections.toArray();
    const existingLinks = await db.links.toArray();

    const pageIdMap = new Map<number, number>();
    const sectionIdMap = new Map<number, number>();

    // Step 1: Pages import with case-insensitive matching
    const sortedPages = [...pagesList].sort((a, b) => a.order - b.order);
    for (const page of sortedPages) {
      const pageNameLower = page.name.toLowerCase();
      let targetPage = existingPages.find(p => p.name.toLowerCase() === pageNameLower);

      let finalPageId: number;
      if (targetPage && mode === 'merge') {
        finalPageId = targetPage.id!;
      } else {
        const nextOrder = (await db.pages.count()) + 1;
        finalPageId = await db.pages.add({
          name: page.name,
          order: nextOrder,
          createdAt: page.createdAt || new Date().toISOString()
        });
        addedPages++;
        
        // Cache to prevent duplicate pages within the same import file from creating duplicates
        existingPages.push({
          id: finalPageId,
          name: page.name,
          order: nextOrder,
          createdAt: page.createdAt || new Date().toISOString()
        });
      }

      if (page.id !== undefined) {
        pageIdMap.set(page.id, finalPageId);
      }
    }

    // Step 2: Sections import with case-insensitive matching per page scope
    const sortedSections = [...sectionsList].sort((a, b) => a.order - b.order);
    for (const section of sortedSections) {
      const parentPageId = pageIdMap.get(section.pageId);
      if (parentPageId === undefined) {
        // Skip orphaned sections
        continue;
      }

      const secNameLower = section.name.toLowerCase();
      let targetSection = existingSections.find(
        s => s.pageId === parentPageId && s.name.toLowerCase() === secNameLower
      );

      let finalSectionId: number;
      if (targetSection && mode === 'merge') {
        finalSectionId = targetSection.id!;
      } else {
        const nextOrder = (await db.sections.where('pageId').equals(parentPageId).count()) + 1;
        finalSectionId = await db.sections.add({
          pageId: parentPageId,
          name: section.name,
          order: nextOrder,
          createdAt: section.createdAt || new Date().toISOString()
        });
        addedSections++;

        existingSections.push({
          id: finalSectionId,
          pageId: parentPageId,
          name: section.name,
          order: nextOrder,
          createdAt: section.createdAt || new Date().toISOString()
        });
      }

      if (section.id !== undefined) {
        sectionIdMap.set(section.id, finalSectionId);
      }
    }

    // Step 3: Links import with normalized URL deduplication
    const sortedLinks = [...linksList].sort((a, b) => a.order - b.order);
    const existingNormUrls = new Set(existingLinks.map(l => l.normalizedUrl));

    for (const link of sortedLinks) {
      const parentSectionId = sectionIdMap.get(link.sectionId);
      if (parentSectionId === undefined) {
        // Skip orphaned links
        continue;
      }

      const normUrl = link.normalizedUrl || normalizeUrl(link.url);

      if (mode === 'merge' && existingNormUrls.has(normUrl)) {
        skippedLinks++;
        continue;
      }

      const domain = link.faviconDomain || extractDomain(link.url);
      const nextOrder = (await db.links.where('sectionId').equals(parentSectionId).count()) + 1;

      await db.links.add({
        sectionId: parentSectionId,
        title: link.title,
        url: link.url,
        normalizedUrl: normUrl,
        faviconDomain: domain,
        order: nextOrder,
        tags: link.tags || [],
        createdAt: link.createdAt || new Date().toISOString()
      });

      addedLinks++;
      existingNormUrls.add(normUrl);
    }

    // Rebuild FlexSearch index in memory with final records
    const finalLinks = await db.links.toArray();
    initSearchIndex(finalLinks);

    return {
      addedPages,
      addedSections,
      addedLinks,
      skippedLinks
    };
  });
}
