import * as React from 'react';
import { db, type Page } from '../db/schema';
import { addPage, updatePage, deletePage } from '../db/operations';
import { useLiveQuery } from 'dexie-react-hooks';
import { SettingsDialog } from './SettingsDialog';
import { SearchPalette } from './SearchPalette';
import { useSettings } from '../context/SettingsContext';
import {
  Plus,
  Settings,
  Search,
  Moon,
  Sun,
  Edit2,
  Trash2,
  FolderHeart,
  MoreHorizontal
} from 'lucide-react';
import {
  DndContext,
  useSensors,
  useSensor,
  PointerSensor,
  TouchSensor,
  type DragEndEvent
} from '@dnd-kit/core';
import { useSortable, SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input
} from './ui';

interface LayoutProps {
  activePageId: number | null;
  setActivePageId: (id: number | null) => void;
  children: React.ReactNode;
}

// Wrapper for draggable Page Tabs
interface SortableTabProps {
  page: Page;
  isActive: boolean;
  onClick: () => void;
  onRename: (page: Page) => void;
  onDelete: (id: number) => void;
}

function SortableTab({ page, isActive, onClick, onRename, onDelete }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: page.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`group relative flex items-center gap-1.5 h-10 px-4 rounded-xl border text-sm font-semibold transition-all duration-200 select-none cursor-pointer ${
        isActive
          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-transparent text-white shadow-md'
          : 'bg-card/40 border-border text-muted-foreground hover:text-foreground hover:border-slate-400 dark:hover:border-slate-700'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Click target for switching pages */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing mr-1 flex-1 h-full flex items-center"
      >
        {page.name}
      </span>

      {/* Settings dropdown for page */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            onClick={(e) => e.stopPropagation()}
            className="p-0.5 rounded text-slate-500 hover:text-slate-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onRename(page)}>
            <Edit2 className="mr-2 h-3.5 w-3.5" />
            Rename Page
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(page.id!)}
            className="text-red-400 hover:text-red-300 focus:bg-red-950/20"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete Page
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Layout({ activePageId, setActivePageId, children }: LayoutProps) {
  // Query all pages sorted by order
  const pages = useLiveQuery(
    async () => {
      const records = await db.pages.toArray();
      return records.sort((a, b) => a.order - b.order);
    },
    []
  ) || [];

  // Configure Sensors for drag-and-drop click safety
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5 // Drag starts only after moving 5px
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5
      }
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pages.findIndex(p => p.id === active.id);
    const newIndex = pages.findIndex(p => p.id === over.id);
    const newPages = arrayMove(pages, oldIndex, newIndex);

    await db.transaction('rw', db.pages, async () => {
      for (let i = 0; i < newPages.length; i++) {
        await db.pages.update(newPages[i].id!, { order: i + 1 });
      }
    });
  };

  // Dialog & Modal Control States
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isAddPageOpen, setIsAddPageOpen] = React.useState(false);
  
  // Page editing states
  const [editingPage, setEditingPage] = React.useState<Page | null>(null);
  const [isRenamePageOpen, setIsRenamePageOpen] = React.useState(false);
  const [isDeletePageOpen, setIsDeletePageOpen] = React.useState(false);
  const [deleteTargetId, setDeleteTargetId] = React.useState<number | null>(null);

  // Form inputs
  const [pageNameInput, setPageNameInput] = React.useState('');
  const [renameInput, setRenameInput] = React.useState('');

  // Dark/Light Theme and settings manager
  const { theme, setTheme, columnsCount, setColumnsCount } = useSettings();
  
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleAddPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageNameInput.trim()) return;

    const newId = await addPage(pageNameInput.trim());
    setPageNameInput('');
    setIsAddPageOpen(false);
    setActivePageId(newId);
  };

  const handleRenamePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameInput.trim() || !editingPage) return;

    await updatePage(editingPage.id!, { name: renameInput.trim() });
    setRenameInput('');
    setEditingPage(null);
    setIsRenamePageOpen(false);
  };

  const handleDeletePage = async () => {
    if (deleteTargetId === null) return;
    
    await deletePage(deleteTargetId);
    
    // If the active page was deleted, switch to the first page available
    if (activePageId === deleteTargetId) {
      const remaining = pages.filter(p => p.id !== deleteTargetId);
      setActivePageId(remaining.length > 0 ? remaining[0].id! : null);
    }
    
    setDeleteTargetId(null);
    setIsDeletePageOpen(false);
  };

  // Keyboard shortcut Ctrl/Cmd+K or / toggles SearchPalette
  const triggerSearch = () => {
    setIsSearchOpen(prev => !prev);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300 relative overflow-x-hidden">
      
      {/* Ambient background glow shapes for glassmorphism backdrop */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-violet-400/15 dark:bg-violet-600/5 blur-[120px]" />
        <div className="absolute bottom-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-indigo-400/15 dark:bg-indigo-600/5 blur-[120px]" />
        <div className="absolute top-[40%] left-[30%] w-[35vw] h-[35vw] rounded-full bg-cyan-400/12 dark:bg-cyan-600/5 blur-[100px]" />
      </div>

      {/* ====================================================================
          TOP NAVIGATION HEADER
          ==================================================================== */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-white/70 dark:bg-slate-950/75 backdrop-blur-md select-none shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Logo Branding */}
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => pages.length > 0 && setActivePageId(pages[0].id!)}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md shadow-violet-500/20 text-white">
              <FolderHeart className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400">
              LinkHub
            </span>
          </div>

          {/* Search Trigger Input */}
          <button
            onClick={triggerSearch}
            className="flex items-center w-full max-w-md h-10 px-4 rounded-xl border border-border bg-card/40 hover:bg-card/65 hover:border-slate-400 dark:hover:border-slate-700 text-left text-muted-foreground transition-all duration-300 focus:outline-none"
          >
            <Search className="h-4 w-4 mr-2.5 text-muted-foreground shrink-0" />
            <span className="text-sm flex-1">Search bookmarks...</span>
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted/80 px-1.5 font-mono text-[9px] font-medium text-muted-foreground tracking-normal">
              Ctrl+K
            </kbd>
          </button>

          {/* Tools Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/40"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Dashboard settings */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
              className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/40"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ====================================================================
          PAGES TAB SWITCHER (WORKSPACE BAR)
          ==================================================================== */}
      <section className="sticky top-16 z-30 border-b border-border bg-white/45 dark:bg-slate-950/50 backdrop-blur-sm select-none shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 overflow-x-auto scrollbar pb-1 md:pb-0">
            {pages.length > 0 && (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={pages.map(p => p.id!)} strategy={horizontalListSortingStrategy}>
                  <div className="flex items-center gap-2.5">
                    {pages.map(page => (
                      <SortableTab
                        key={page.id}
                        page={page}
                        isActive={activePageId === page.id}
                        onClick={() => setActivePageId(page.id!)}
                        onRename={(p) => {
                          setEditingPage(p);
                          setRenameInput(p.name);
                          setIsRenamePageOpen(true);
                        }}
                        onDelete={(id) => {
                          setDeleteTargetId(id);
                          setIsDeletePageOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Add Page button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddPageOpen(true)}
              className="h-10 px-3.5 rounded-xl text-xs font-semibold gap-1.5 border-dashed border-border bg-transparent hover:border-slate-400 dark:hover:border-slate-700 select-none shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              New Page
            </Button>
          </div>

          {/* Configurable Columns Dropdown next to workspaces */}
          <div className="flex items-center gap-2 shrink-0 select-none">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 px-3 rounded-xl text-xs font-semibold gap-1.5 border-border bg-transparent hover:bg-muted/40 shrink-0"
                >
                  Columns: {columnsCount}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {[2, 3, 4, 5].map((num) => (
                  <DropdownMenuItem 
                    key={num} 
                    onClick={() => setColumnsCount(num)}
                    className="flex justify-between items-center gap-6"
                  >
                    <span>{num} Columns</span>
                    {columnsCount === num && <span className="text-violet-500 font-bold font-mono">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </section>

      {/* ====================================================================
          MAIN APP CANVAS
          ==================================================================== */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-8">
        {children}
      </main>

      {/* ====================================================================
          MODAL INTERFACES & DIALOGS
          ==================================================================== */}
      <SearchPalette isOpen={isSearchOpen} onClose={triggerSearch} />
      
      <SettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

      {/* ADD PAGE DIALOG */}
      <Dialog open={isAddPageOpen} onOpenChange={setIsAddPageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Page Workspace</DialogTitle>
            <DialogDescription>
              Create a new dashboard workspace to organize your links.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPage} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Page Title
              </label>
              <Input
                value={pageNameInput}
                onChange={e => setPageNameInput(e.target.value)}
                placeholder="Work Dashboard, Shopping List, etc."
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddPageOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Page</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* RENAME PAGE DIALOG */}
      <Dialog open={isRenamePageOpen} onOpenChange={setIsRenamePageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page Workspace</DialogTitle>
            <DialogDescription>Modify the workspace page title.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRenamePage} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Page Title
              </label>
              <Input
                value={renameInput}
                onChange={e => setRenameInput(e.target.value)}
                placeholder="My Dashboard"
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsRenamePageOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE PAGE DIALOG */}
      <Dialog open={isDeletePageOpen} onOpenChange={setIsDeletePageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this page? This will permanently delete all sections
              and bookmark links inside this page. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsDeletePageOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeletePage}>
              Delete Permanent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
