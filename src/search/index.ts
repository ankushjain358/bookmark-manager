import { Index } from 'flexsearch';
import { type Link } from '../db/schema';

// Initialize a FlexSearch index with forward tokenization (great for autocomplete)
export const flexIndex = new Index({
  tokenize: 'forward',
  cache: true
});

/**
 * Rebuilds the search index from scratch with a list of links.
 */
export function initSearchIndex(links: Link[]) {
  // Clear the index first
  // Note: FlexSearch Index doesn't have a direct clear() in some versions,
  // but we can re-create or remove items. Actually, the safest way to clear is to remove
  // all keys or re-initialize. Let's do a simple check or recreation.
  // Wait, we can iterate and remove if we track keys, or just create a new Index instance,
  // but if we export a single instance, we can't easily reassign unless we wrap it in a container.
  // Let's wrap the index in a helper object!
  indexContainer.index = new Index({
    tokenize: 'forward',
    cache: true
  });
  
  for (const link of links) {
    if (link.id !== undefined) {
      indexContainer.index.add(link.id, `${link.title} ${link.url}`);
    }
  }
}

// Container to allow index swapping/recreation
const indexContainer = {
  index: flexIndex
};

/**
 * Adds a single link to the index.
 */
export function addLinkToIndex(link: Link) {
  if (link.id !== undefined) {
    indexContainer.index.add(link.id, `${link.title} ${link.url}`);
  }
}

/**
 * Updates a single link in the index.
 */
export function updateLinkInIndex(link: Link) {
  if (link.id !== undefined) {
    indexContainer.index.update(link.id, `${link.title} ${link.url}`);
  }
}

/**
 * Removes a single link from the index.
 */
export function removeLinkFromIndex(id: number) {
  indexContainer.index.remove(id);
}

/**
 * Searches the index for matching links.
 * Returns the IDs of the matching links.
 */
export function searchLinks(query: string): number[] {
  if (!query.trim()) return [];
  const results = indexContainer.index.search(query);
  return results.map(id => Number(id));
}
