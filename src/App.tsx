import * as React from 'react';
import { db } from './db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { initSearchIndex } from './search';
import { Layout } from './components/Layout';
import { PageGrid } from './components/PageGrid';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui';
import { addPage } from './db/operations';
import { FolderPlus, FileUp, Sparkles } from 'lucide-react';
import { SettingsProvider } from './context/SettingsContext';
import { SettingsDialog } from './components/SettingsDialog';

function AppContent() {
  const pages = useLiveQuery(() => db.pages.toArray()) || [];
  const allLinks = useLiveQuery(() => db.links.toArray());

  const [activePageId, setActivePageId] = React.useState<number | null>(null);
  const [isAddPageOpen, setIsAddPageOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [pageName, setPageName] = React.useState('');

  // 1. Rebuild FlexSearch index on database load or sync changes
  React.useEffect(() => {
    if (allLinks) {
      initSearchIndex(allLinks);
    }
  }, [allLinks]);

  // 2. Set default active page if none is set and pages exist
  React.useEffect(() => {
    if (pages.length > 0 && activePageId === null) {
      // Sort pages by order first to choose the first ordered page
      const sorted = [...pages].sort((a, b) => a.order - b.order);
      setActivePageId(sorted[0].id!);
    } else if (pages.length === 0) {
      setActivePageId(null);
    }
  }, [pages, activePageId]);

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageName.trim()) return;

    const newId = await addPage(pageName.trim());
    setPageName('');
    setIsAddPageOpen(false);
    setActivePageId(newId);
  };


  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {pages.length === 0 ? (
        // Empty State Hero - Welcome Page
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-radial-gradient">
          <div className="relative w-full max-w-lg p-8 rounded-3xl border border-border bg-card/85 shadow-2xl glass-panel text-center select-none animate-in fade-in zoom-in-95 duration-500">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-xl shadow-violet-500/20 text-white">
              <Sparkles className="h-10 w-10 animate-pulse" />
            </div>

            <div className="pt-8">
              <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-indigo-400 light:from-violet-600 light:to-indigo-600">
                Welcome to LinkHub
              </h1>
              <p className="text-sm text-muted-foreground mt-2.5 max-w-sm mx-auto leading-relaxed">
                Your local-first, zero-backend bookmark and start page organizer. 
                Everything is stored securely inside your browser's IndexedDB.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                <Button 
                  onClick={() => setIsAddPageOpen(true)}
                  className="gap-2 h-11 px-5 text-sm font-semibold rounded-xl"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create Page Workspace
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsSettingsOpen(true)}
                  className="gap-2 h-11 px-5 text-sm font-semibold rounded-xl border-border hover:border-slate-400 dark:hover:border-slate-700 bg-transparent"
                >
                  <FileUp className="h-4 w-4 text-violet-400" />
                  Import Backups
                </Button>
              </div>
            </div>
          </div>

          {/* Settings dialog for import */}
          <SettingsDialog isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

          {/* Add Page Modal */}
          <Dialog open={isAddPageOpen} onOpenChange={setIsAddPageOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Page Workspace</DialogTitle>
                <DialogDescription>
                  Enter a title to create your first tab workspace.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreatePage} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Page Title
                  </label>
                  <Input
                    value={pageName}
                    onChange={e => setPageName(e.target.value)}
                    placeholder="E.g., Developer Tools, News & Reading"
                    required
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddPageOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Workspace</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        // Regular layout with grid
        <Layout activePageId={activePageId} setActivePageId={setActivePageId}>
          {activePageId !== null && (
            <PageGrid activePageId={activePageId} />
          )}
        </Layout>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
