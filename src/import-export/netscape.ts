import { type Page, type Section, type Link } from '../db/schema';
import { handleImportData } from './dedup';

export interface ImportedLink {
  title: string;
  url: string;
  tags?: string[];
}

export interface ImportedSection {
  name: string;
  links: ImportedLink[];
}

export interface ImportedPage {
  name: string;
  sections: ImportedSection[];
}

/**
 * Parses Netscape Bookmark HTML and returns structured data.
 */
export function parseNetscapeBookmarks(htmlStr: string): {
  pages: ImportedPage[];
  flattenedFoldersCount: number;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlStr, 'text/html');
  const pages: ImportedPage[] = [];
  let stats = { flattenedFoldersCount: 0 };

  const mainDl = doc.querySelector('dl');
  if (!mainDl) {
    throw new Error('Could not find standard bookmark list (<DL>) in HTML.');
  }

  function walk(
    dl: Element,
    depth: number,
    currentPath: string[],
    currentPage: ImportedPage | null,
    currentSection: ImportedSection | null
  ) {
    let child = dl.firstElementChild;
    while (child) {
      if (child.tagName === 'DT') {
        const h3 = child.querySelector('h3');
        const a = child.querySelector('a');

        if (h3) {
          const folderName = h3.textContent?.trim() || 'Untitled Folder';
          // Find next sibling or nested DL for the folder contents
          const nextDl = child.querySelector('dl') || child.nextElementSibling;

          if (nextDl && nextDl.tagName === 'DL') {
            if (depth === 0) {
              // Depth 0 folder: Bookmark Bar / root folder -> Page
              const newPage: ImportedPage = {
                name: folderName,
                sections: []
              };
              pages.push(newPage);
              walk(nextDl, depth + 1, [], newPage, null);
            } else if (depth === 1) {
              // Depth 1 folder: folder inside Page -> Section
              if (currentPage) {
                const newSection: ImportedSection = {
                  name: folderName,
                  links: []
                };
                currentPage.sections.push(newSection);
                walk(nextDl, depth + 1, [], currentPage, newSection);
              }
            } else {
              // Depth >= 2 folder: Deep nesting -> Flatten and add path to tags
              stats.flattenedFoldersCount++;
              const newPath = [...currentPath, folderName];
              walk(nextDl, depth + 1, newPath, currentPage, currentSection);
            }
          }
        } else if (a) {
          const title = a.textContent?.trim() || a.href;
          const url = a.getAttribute('href') || '';

          if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('chrome://'))) {
            let page = currentPage;
            if (!page) {
              page = {
                name: 'Bookmarks',
                sections: []
              };
              pages.push(page);
            }

            let section = currentSection;
            if (!section) {
              // Loose links directly under Page -> put in "General" section
              section = page.sections.find(s => s.name === 'General') || null;
              if (!section) {
                section = {
                  name: 'General',
                  links: []
                };
                page.sections.push(section);
              }
            }

            const tags = currentPath.length > 0 ? [currentPath.join('/')] : [];
            section.links.push({
              title,
              url,
              tags
            });
          }
        }
      }
      child = child.nextElementSibling;
    }
  }

  walk(mainDl, 0, [], null, null);

  // Clean empty folders/pages
  const filteredPages = pages.filter(
    p => p.sections.some(s => s.links.length > 0) || p.name !== 'Bookmarks'
  );

  return {
    pages: filteredPages,
    flattenedFoldersCount: stats.flattenedFoldersCount
  };
}

/**
 * Handles Netscape Bookmark HTML imports and merges/replaces tables in the DB.
 */
export async function importFromNetscape(
  htmlStr: string,
  mode: 'merge' | 'replace'
): Promise<{
  addedPages: number;
  addedSections: number;
  addedLinks: number;
  skippedLinks: number;
  flattenedFoldersCount: number;
}> {
  const { pages, flattenedFoldersCount } = parseNetscapeBookmarks(htmlStr);
  
  // Reconstruct arrays for handleImportData
  const pagesList: any[] = [];
  const sectionsList: any[] = [];
  const linksList: any[] = [];

  let tempPageId = 1;
  let tempSectionId = 1;

  for (const page of pages) {
    const pageId = tempPageId++;
    pagesList.push({
      id: pageId,
      name: page.name,
      order: pageId,
      createdAt: new Date().toISOString()
    });

    for (const section of page.sections) {
      const sectionId = tempSectionId++;
      sectionsList.push({
        id: sectionId,
        pageId: pageId,
        name: section.name,
        order: sectionId,
        createdAt: new Date().toISOString()
      });

      for (const link of section.links) {
        linksList.push({
          sectionId: sectionId,
          title: link.title,
          url: link.url,
          tags: link.tags,
          createdAt: new Date().toISOString()
        });
      }
    }
  }

  const result = await handleImportData(pagesList, sectionsList, linksList, mode);
  return {
    ...result,
    flattenedFoldersCount
  };
}

/**
 * Serializes database tables into a Netscape Bookmark HTML string.
 */
export function exportToNetscape(
  pages: Page[],
  sections: Section[],
  links: Link[]
): string {
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and written by edit Bookmarks.
     Do Not Edit! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  const sortedPages = [...pages].sort((a, b) => a.order - b.order);

  for (const page of sortedPages) {
    html += `    <DT><H3>${escapeHtml(page.name)}</H3>\n    <DL><p>\n`;

    const pageSections = sections
      .filter(s => s.pageId === page.id)
      .sort((a, b) => a.order - b.order);

    for (const section of pageSections) {
      html += `        <DT><H3>${escapeHtml(section.name)}</H3>\n        <DL><p>\n`;

      const sectionLinks = links
        .filter(l => l.sectionId === section.id)
        .sort((a, b) => a.order - b.order);

      for (const link of sectionLinks) {
        html += `            <DT><A HREF="${escapeUrl(link.url)}">${escapeHtml(link.title)}</A>\n`;
      }

      html += `        </DL><p>\n`;
    }

    html += `    </DL><p>\n`;
  }

  html += `</DL><p>\n`;
  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeUrl(str: string): string {
  return str.replace(/"/g, '%22');
}
