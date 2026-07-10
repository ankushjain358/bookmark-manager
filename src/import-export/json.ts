import { db } from '../db/schema';
import { handleImportData } from './dedup';

export async function exportToJson(): Promise<string> {
  const pages = await db.pages.toArray();
  const sections = await db.sections.toArray();
  const links = await db.links.toArray();

  const data = {
    version: 1,
    pages,
    sections,
    links
  };

  return JSON.stringify(data, null, 2);
}

export async function importFromJson(
  jsonStr: string,
  mode: 'merge' | 'replace'
): Promise<{
  addedPages: number;
  addedSections: number;
  addedLinks: number;
  skippedLinks: number;
  flattenedFoldersCount: number;
}> {
  const data = JSON.parse(jsonStr);
  if (!data || !Array.isArray(data.pages) || !Array.isArray(data.sections) || !Array.isArray(data.links)) {
    throw new Error('Invalid JSON backup file. Must contain pages, sections, and links.');
  }

  const result = await handleImportData(data.pages, data.sections, data.links, mode);
  return {
    ...result,
    flattenedFoldersCount: 0 // JSON import is flat and doesn't need deep folder flattening
  };
}
