import * as React from 'react';
import { Command } from 'cmdk';
import { Search, Link2, CornerDownLeft } from 'lucide-react';
import { searchLinks } from '../search';
import { db } from '../db/schema';
import { useLiveQuery } from 'dexie-react-hooks';

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchPalette({ isOpen, onClose }: SearchPaletteProps) {
  const [search, setSearch] = React.useState('');
  const allLinks = useLiveQuery(() => db.links.toArray()) || [];
  const sections = useLiveQuery(() => db.sections.toArray()) || [];
  const pages = useLiveQuery(() => db.pages.toArray()) || [];

  // Map sectionId to Page Name > Section Name breadcrumbs
  const hierarchyMap = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const sec of sections) {
      const page = pages.find(p => p.id === sec.pageId);
      const pageLabel = page ? page.name : 'Unknown';
      map.set(sec.id!, `${pageLabel} › ${sec.name}`);
    }
    return map;
  }, [sections, pages]);

  // Filter links dynamically using FlexSearch results
  const results = React.useMemo(() => {
    if (!search.trim()) return [];
    const matchedIds = searchLinks(search);
    const matchedSet = new Set(matchedIds);
    return allLinks.filter(l => l.id !== undefined && matchedSet.has(l.id));
  }, [search, allLinks]);

  // Handle keyboard shortcut for opening/closing search palette
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        // Don't trigger if user is typing in another input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          setSearch('');
          // Allow parent to set state
          onClose(); // This is just a toggle trigger in Parent
        }
      }
      
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Glassy Overlay Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in" 
        onClick={onClose} 
      />

      {/* Palette Container */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl glass-panel animate-in fade-in zoom-in-95 duration-200 mx-4">
        <Command label="Search bookmarks" className="flex flex-col">
          <div className="flex items-center border-b border-border px-4 py-3">
            <Search className="mr-3 h-5 w-5 text-muted-foreground shrink-0" />
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Search links by title or URL... (Press ESC to close)"
              className="flex-1 bg-transparent text-foreground placeholder-slate-500 outline-none text-base border-0 focus:ring-0 focus:outline-none"
            />
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[350px] overflow-y-auto p-2 scrollbar">
            {search.trim().length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                Type something to start searching your links...
              </div>
            ) : results.length === 0 ? (
              <Command.Empty className="py-6 text-center text-sm text-slate-500">
                No matching bookmarks found.
              </Command.Empty>
            ) : (
              results.map((link) => (
                <Command.Item
                  key={link.id}
                  value={`${link.title} ${link.url}`}
                  onSelect={() => {
                    window.open(link.url, '_blank', 'noopener,noreferrer');
                    onClose();
                  }}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted border border-border text-muted-foreground shrink-0 group-hover:border-violet-500/30">
                      <Link2 className="h-4 w-4 text-violet-400 shrink-0" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm text-foreground truncate">{link.title}</span>
                      <span className="text-xs text-muted-foreground/80 truncate">{link.url}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Page > Section Breadcrumb badge */}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-mono">
                      {hierarchyMap.get(link.sectionId) || 'Unsorted'}
                    </span>
                    
                    {link.tags && link.tags.map(t => (
                      <span 
                        key={t} 
                        className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950/40 border border-violet-800/30 text-violet-400 font-mono"
                      >
                        {t}
                      </span>
                    ))}
                    <span className="hidden group-hover:flex items-center text-[10px] text-muted-foreground gap-0.5">
                      Open <CornerDownLeft className="h-3 w-3" />
                    </span>
                  </div>
                </Command.Item>
              ))
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
